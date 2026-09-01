import { auth } from "@clerk/nextjs/server";
import { db } from "@khoroch/db";
import { accounts, categories, transactionEntries, transactions } from "@khoroch/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { aiTransactionTypes } from "@/lib/finance/ai-quick-entry";
import { occurredBeforeBalanceTracking } from "@/lib/finance/balance-tracking";
import { ApiInputError, handleRouteError, readJson, unauthorized } from "@/lib/finance/http";

const optionalId = z
  .uuid()
  .nullish()
  .transform((value) => value ?? null);

const finalizeSchema = z.object({
  entries: z
    .array(
      z.object({
        clientRequestId: z.string().trim().min(8).max(128),
        type: z.enum(aiTransactionTypes),
        title: z.string().trim().min(1).max(120),
        amount: z
          .number()
          .finite()
          .positive()
          .max(999_999_999_999.99)
          .transform((value) => Math.round(value * 100) / 100),
        occurredAt: z.iso.datetime({ offset: true }),
        accountId: z.uuid(),
        destinationAccountId: optionalId,
        categoryId: optionalId,
        note: z
          .string()
          .trim()
          .max(1_000)
          .nullish()
          .transform((value) => value || null),
      }),
    )
    .min(1)
    .max(100),
});

export async function POST(request: Request) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return unauthorized();

  try {
    const input = finalizeSchema.parse(await readJson(request));
    const clientRequestIds = input.entries.map((entry) => entry.clientRequestId);
    if (new Set(clientRequestIds).size !== clientRequestIds.length) {
      throw new ApiInputError("The review contains duplicate entries");
    }

    const accountIds = [
      ...new Set(
        input.entries.flatMap((entry) => [
          entry.accountId,
          ...(entry.destinationAccountId ? [entry.destinationAccountId] : []),
        ]),
      ),
    ];
    const categoryIds = [
      ...new Set(input.entries.flatMap((entry) => (entry.categoryId ? [entry.categoryId] : []))),
    ];

    const [ownedAccounts, ownedCategories, existingTransactions] = await Promise.all([
      db
        .select({
          id: accounts.id,
          currency: accounts.currency,
          openingBalanceAt: accounts.openingBalanceAt,
        })
        .from(accounts)
        .where(
          and(
            eq(accounts.userId, userId),
            inArray(accounts.id, accountIds),
            isNull(accounts.deletedAt),
          ),
        ),
      categoryIds.length > 0
        ? db
            .select({ id: categories.id, kind: categories.kind })
            .from(categories)
            .where(
              and(
                eq(categories.userId, userId),
                inArray(categories.id, categoryIds),
                isNull(categories.deletedAt),
              ),
            )
        : Promise.resolve([]),
      db
        .select({ id: transactions.id, clientRequestId: transactions.clientRequestId })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            inArray(transactions.clientRequestId, clientRequestIds),
          ),
        ),
    ]);

    if (ownedAccounts.length !== accountIds.length) {
      throw new ApiInputError("One or more selected accounts are no longer available");
    }
    if (ownedCategories.length !== categoryIds.length) {
      throw new ApiInputError("One or more selected categories are no longer available");
    }

    const accountById = new Map(ownedAccounts.map((account) => [account.id, account]));
    const categoryById = new Map(ownedCategories.map((category) => [category.id, category]));
    const existingRequestIds = new Set(
      existingTransactions.flatMap((transaction) =>
        transaction.clientRequestId ? [transaction.clientRequestId] : [],
      ),
    );

    for (const entry of input.entries) {
      const occurredAt = new Date(entry.occurredAt);
      const sourceAccount = accountById.get(entry.accountId);
      if (!sourceAccount) throw new ApiInputError("Choose a valid source account for every entry");

      if (entry.type === "transfer") {
        const destinationAccount = entry.destinationAccountId
          ? accountById.get(entry.destinationAccountId)
          : null;
        if (!destinationAccount || destinationAccount.id === sourceAccount.id) {
          throw new ApiInputError(`Choose two different accounts for “${entry.title}”`);
        }
        if (destinationAccount.currency !== sourceAccount.currency) {
          throw new ApiInputError(
            `“${entry.title}” moves between different currencies and needs a manual exchange entry`,
          );
        }
        if (
          occurredBeforeBalanceTracking(occurredAt, sourceAccount.openingBalanceAt) ||
          occurredBeforeBalanceTracking(occurredAt, destinationAccount.openingBalanceAt)
        ) {
          throw new ApiInputError(
            `“${entry.title}” is dated before one of its accounts began balance tracking`,
          );
        }
      } else if (entry.destinationAccountId) {
        throw new ApiInputError(`“${entry.title}” has an unexpected destination account`);
      }

      if (entry.categoryId) {
        const expectedKind = entry.type === "income" ? "income" : "expense";
        if (
          entry.type === "transfer" ||
          categoryById.get(entry.categoryId)?.kind !== expectedKind
        ) {
          throw new ApiInputError(`“${entry.title}” uses the wrong category type`);
        }
      }
    }

    const createdIds = await db.transaction(async (tx) => {
      const ids: string[] = [];
      for (const entry of input.entries) {
        if (existingRequestIds.has(entry.clientRequestId)) continue;

        const occurredAt = new Date(entry.occurredAt);
        const [created] = await tx
          .insert(transactions)
          .values({
            userId,
            clientRequestId: entry.clientRequestId,
            type: entry.type,
            status: "cleared",
            occurredAt,
            title: entry.title,
            payee: null,
            note: entry.note,
            parentTransactionId: null,
          })
          .returning({ id: transactions.id });

        const sourceAccount = accountById.get(entry.accountId)!;
        const affectsSourceBalance = !occurredBeforeBalanceTracking(
          occurredAt,
          sourceAccount.openingBalanceAt,
        );
        const ledgerEntries =
          entry.type === "transfer"
            ? [
                {
                  accountId: entry.accountId,
                  amount: -entry.amount,
                  memo: "Transfer out",
                  affectsBalance: true,
                },
                {
                  accountId: entry.destinationAccountId!,
                  amount: entry.amount,
                  memo: "Transfer in",
                  affectsBalance: true,
                },
              ]
            : [
                {
                  accountId: entry.accountId,
                  amount: entry.type === "expense" ? -entry.amount : entry.amount,
                  memo: null,
                  affectsBalance: affectsSourceBalance,
                },
              ];

        await tx.insert(transactionEntries).values(
          ledgerEntries.map((ledgerEntry, sortOrder) => ({
            ...ledgerEntry,
            userId,
            transactionId: created.id,
            categoryId: entry.type === "transfer" ? null : entry.categoryId,
            budgetItemId: null,
            fundingBucketId: null,
            sortOrder,
          })),
        );
        ids.push(created.id);
      }
      return ids;
    });

    return Response.json({
      createdCount: createdIds.length,
      skippedCount: existingTransactions.length,
      transactionIds: [...existingTransactions.map((transaction) => transaction.id), ...createdIds],
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
