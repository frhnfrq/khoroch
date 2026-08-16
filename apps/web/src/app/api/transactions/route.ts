import { auth } from "@clerk/nextjs/server";
import { db } from "@khoroch/db";
import {
  accounts,
  budgetItems,
  budgets,
  categories,
  fundingBuckets,
  transactionEntries,
  transactions,
} from "@khoroch/db/schema";
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { handleRouteError, readJson, unauthorized } from "@/lib/finance/http";
import { occurredBeforeBalanceTracking } from "@/lib/finance/balance-tracking";
import { getTransactionDisplayAmount, getTransferFee } from "@/lib/finance/format";
import { createTransactionSchema, transactionFiltersSchema } from "@/lib/finance/validation";
import type {
  TransactionEntryView,
  TransactionTotalView,
  TransactionView,
} from "@/lib/finance/types";

export async function GET(request: Request) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return unauthorized();

  try {
    const url = new URL(request.url);
    const filters = transactionFiltersSchema.parse(Object.fromEntries(url.searchParams));
    const conditions: SQL[] = [eq(transactions.userId, userId), isNull(transactions.deletedAt)];

    if (filters.from) conditions.push(gte(transactions.occurredAt, new Date(filters.from)));
    if (filters.to) conditions.push(lte(transactions.occurredAt, new Date(filters.to)));
    if (filters.type) conditions.push(eq(transactions.type, filters.type));
    if (filters.status) conditions.push(eq(transactions.status, filters.status));
    if (filters.query) {
      const query = `%${filters.query}%`;
      const searchCondition = or(
        ilike(transactions.title, query),
        ilike(transactions.payee, query),
        ilike(transactions.note, query),
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    const summaryConditions = [
      ...conditions,
      inArray(transactions.type, ["expense", "income"]),
      ne(transactions.status, "void"),
    ];
    const summaryPromise = filters.includeSummary
      ? db
          .select({
            type: transactions.type,
            currency: accounts.currency,
            amount: sql<number>`coalesce(sum(
              case
                when ${transactions.type} = 'expense' and ${transactionEntries.amount} < 0
                  then -${transactionEntries.amount}
                when ${transactions.type} = 'income' and ${transactionEntries.amount} > 0
                  then ${transactionEntries.amount}
                else 0
              end
            ), 0)`,
          })
          .from(transactions)
          .innerJoin(
            transactionEntries,
            and(
              eq(transactionEntries.transactionId, transactions.id),
              eq(transactionEntries.userId, userId),
            ),
          )
          .innerJoin(
            accounts,
            and(eq(accounts.id, transactionEntries.accountId), eq(accounts.userId, userId)),
          )
          .where(and(...summaryConditions))
          .groupBy(transactions.type, accounts.currency)
      : Promise.resolve([]);

    const [transactionRows, summaryRows] = await Promise.all([
      db
        .select()
        .from(transactions)
        .where(and(...conditions))
        .orderBy(desc(transactions.occurredAt), desc(transactions.createdAt))
        .limit(500),
      summaryPromise,
    ]);

    const totals: TransactionTotalView[] = summaryRows.flatMap((row) =>
      row.type === "expense" || row.type === "income"
        ? [{ type: row.type, currency: row.currency, amount: Number(row.amount) }]
        : [],
    );

    if (transactionRows.length === 0) return Response.json({ transactions: [], totals });

    const entries = await db
      .select({
        entry: transactionEntries,
        accountName: accounts.name,
        accountType: accounts.type,
        accountCurrency: accounts.currency,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
        budgetItemName: budgetItems.name,
        fundingBucketName: fundingBuckets.name,
      })
      .from(transactionEntries)
      .innerJoin(accounts, eq(accounts.id, transactionEntries.accountId))
      .leftJoin(categories, eq(categories.id, transactionEntries.categoryId))
      .leftJoin(budgetItems, eq(budgetItems.id, transactionEntries.budgetItemId))
      .leftJoin(fundingBuckets, eq(fundingBuckets.id, transactionEntries.fundingBucketId))
      .where(
        and(
          eq(transactionEntries.userId, userId),
          inArray(
            transactionEntries.transactionId,
            transactionRows.map((transaction) => transaction.id),
          ),
        ),
      )
      .orderBy(transactionEntries.sortOrder);

    const entriesByTransaction = new Map<string, TransactionEntryView[]>();
    for (const row of entries) {
      const transactionEntriesForId = entriesByTransaction.get(row.entry.transactionId) ?? [];
      transactionEntriesForId.push({ ...row.entry, ...row });
      entriesByTransaction.set(row.entry.transactionId, transactionEntriesForId);
    }

    const result: TransactionView[] = [];
    for (const transaction of transactionRows) {
      const transactionEntriesForId = entriesByTransaction.get(transaction.id) ?? [];
      const amount = getTransactionDisplayAmount(transaction.type, transactionEntriesForId);

      if (
        filters.accountId &&
        !transactionEntriesForId.some((entry) => entry.accountId === filters.accountId)
      ) {
        continue;
      }
      if (
        filters.categoryId &&
        !transactionEntriesForId.some((entry) => entry.categoryId === filters.categoryId)
      ) {
        continue;
      }
      if (filters.minAmount !== undefined && amount < filters.minAmount) continue;
      if (filters.maxAmount !== undefined && amount > filters.maxAmount) continue;

      result.push({
        ...transaction,
        amount,
        transferFee: transaction.type === "transfer" ? getTransferFee(transactionEntriesForId) : 0,
        currency: transactionEntriesForId[0]?.accountCurrency ?? "BDT",
        isHistorical:
          transactionEntriesForId.length > 0 &&
          transactionEntriesForId.every((entry) => !entry.affectsBalance),
        entries: transactionEntriesForId,
      });

      if (result.length >= filters.limit) break;
    }

    return Response.json({ transactions: result, totals });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return unauthorized();

  try {
    const input = createTransactionSchema.parse(await readJson(request));

    if (input.clientRequestId) {
      const existing = await db.query.transactions.findFirst({
        where: and(
          eq(transactions.userId, userId),
          eq(transactions.clientRequestId, input.clientRequestId),
        ),
      });
      if (existing) return Response.json({ transaction: existing, idempotent: true });
    }

    const accountIds = [...new Set(input.entries.map((entry) => entry.accountId))];
    const ownedAccounts = await db
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
      );
    if (ownedAccounts.length !== accountIds.length) {
      return Response.json({ error: "One or more accounts are invalid" }, { status: 400 });
    }
    if (input.type === "transfer" && accountIds.length < 2) {
      return Response.json({ error: "A transfer needs two different accounts" }, { status: 400 });
    }
    if (
      input.type === "transfer" &&
      new Set(ownedAccounts.map((account) => account.currency)).size > 1
    ) {
      return Response.json(
        { error: "Transfers between different currencies need an exchange transaction" },
        { status: 400 },
      );
    }
    const accountCurrencyById = new Map(
      ownedAccounts.map((account) => [account.id, account.currency]),
    );
    const occurredAt = new Date(input.occurredAt);
    const historicalAccountIds = new Set(
      ownedAccounts
        .filter((account) => occurredBeforeBalanceTracking(occurredAt, account.openingBalanceAt))
        .map((account) => account.id),
    );
    if (
      historicalAccountIds.size > 0 &&
      (input.type === "transfer" || input.type === "adjustment")
    ) {
      return Response.json(
        { error: "Transfers and balance adjustments must be dated after balance tracking began" },
        { status: 400 },
      );
    }
    if (
      historicalAccountIds.size > 0 &&
      (input.createFundingBucket || input.entries.some((entry) => entry.fundingBucketId))
    ) {
      return Response.json(
        { error: "Historical activity cannot use an income funding bucket" },
        { status: 400 },
      );
    }
    if (
      input.createFundingBucket &&
      ownedAccounts.some((account) => account.currency !== input.createFundingBucket?.currency)
    ) {
      return Response.json(
        { error: "The new funding source currency does not match the selected account" },
        { status: 400 },
      );
    }

    const categoryIds = [
      ...new Set(input.entries.flatMap((entry) => (entry.categoryId ? [entry.categoryId] : []))),
    ];
    const categoryKindById = new Map<string, "expense" | "income">();
    if (categoryIds.length > 0) {
      const ownedCategories = await db
        .select({ id: categories.id, kind: categories.kind })
        .from(categories)
        .where(
          and(
            eq(categories.userId, userId),
            inArray(categories.id, categoryIds),
            isNull(categories.deletedAt),
          ),
        );
      if (ownedCategories.length !== categoryIds.length) {
        return Response.json({ error: "One or more categories are invalid" }, { status: 400 });
      }
      for (const category of ownedCategories) {
        categoryKindById.set(category.id, category.kind);
      }

      for (const entry of input.entries) {
        if (!entry.categoryId) continue;
        const expectedKind =
          input.type === "income"
            ? "income"
            : input.type === "expense" || input.type === "refund"
              ? "expense"
              : entry.amount < 0
                ? "expense"
                : "income";
        if (categoryKindById.get(entry.categoryId) !== expectedKind) {
          return Response.json(
            { error: `A ${input.type} entry uses the wrong category type` },
            { status: 400 },
          );
        }
      }
    }

    const budgetItemIds = [
      ...new Set(
        input.entries.flatMap((entry) => (entry.budgetItemId ? [entry.budgetItemId] : [])),
      ),
    ];
    const budgetCategoryById = new Map<string, string | null>();
    if (budgetItemIds.length > 0) {
      const ownedBudgetItems = await db
        .select({
          id: budgetItems.id,
          categoryId: budgetItems.categoryId,
          currency: budgets.currency,
        })
        .from(budgetItems)
        .innerJoin(budgets, eq(budgets.id, budgetItems.budgetId))
        .where(
          and(
            eq(budgetItems.userId, userId),
            inArray(budgetItems.id, budgetItemIds),
            isNull(budgetItems.deletedAt),
            isNull(budgets.deletedAt),
          ),
        );
      if (ownedBudgetItems.length !== budgetItemIds.length) {
        return Response.json({ error: "One or more budget items are invalid" }, { status: 400 });
      }
      if (!["expense", "refund", "transfer"].includes(input.type)) {
        return Response.json(
          { error: "Only spending, refunds, and transfer fees can use a budget" },
          { status: 400 },
        );
      }
      for (const item of ownedBudgetItems) budgetCategoryById.set(item.id, item.categoryId);
      for (const entry of input.entries) {
        if (!entry.budgetItemId) continue;
        const budgetItem = ownedBudgetItems.find((item) => item.id === entry.budgetItemId);
        if (budgetItem?.currency !== accountCurrencyById.get(entry.accountId)) {
          return Response.json(
            { error: "The budget currency does not match the selected account" },
            { status: 400 },
          );
        }
        if (input.type === "transfer" && entry.amount >= 0) {
          return Response.json(
            { error: "Only a transfer fee can use a budget item" },
            { status: 400 },
          );
        }
        const budgetCategoryId = budgetCategoryById.get(entry.budgetItemId);
        if (budgetCategoryId && entry.categoryId && budgetCategoryId !== entry.categoryId) {
          return Response.json(
            { error: "The selected category does not match the budget item" },
            { status: 400 },
          );
        }
      }
    }

    const fundingBucketIds = [
      ...new Set(
        input.entries.flatMap((entry) => (entry.fundingBucketId ? [entry.fundingBucketId] : [])),
      ),
    ];
    if (fundingBucketIds.length > 0) {
      const ownedFundingBuckets = await db
        .select({ id: fundingBuckets.id, currency: fundingBuckets.currency })
        .from(fundingBuckets)
        .where(
          and(
            eq(fundingBuckets.userId, userId),
            inArray(fundingBuckets.id, fundingBucketIds),
            isNull(fundingBuckets.deletedAt),
          ),
        );
      if (ownedFundingBuckets.length !== fundingBucketIds.length) {
        return Response.json({ error: "One or more funding buckets are invalid" }, { status: 400 });
      }
      const fundingCurrencyById = new Map(
        ownedFundingBuckets.map((bucket) => [bucket.id, bucket.currency]),
      );
      for (const entry of input.entries) {
        if (!entry.fundingBucketId) continue;
        if (
          fundingCurrencyById.get(entry.fundingBucketId) !==
          accountCurrencyById.get(entry.accountId)
        ) {
          return Response.json(
            { error: "The funding source currency does not match the selected account" },
            { status: 400 },
          );
        }
      }
    }

    if (input.parentTransactionId) {
      const parent = await db.query.transactions.findFirst({
        columns: { id: true },
        where: and(
          eq(transactions.id, input.parentTransactionId),
          eq(transactions.userId, userId),
          isNull(transactions.deletedAt),
        ),
      });
      if (!parent) return Response.json({ error: "Invalid parent transaction" }, { status: 400 });
    }

    const created = await db.transaction(async (tx) => {
      let createdFundingBucketId: string | null = null;
      if (input.createFundingBucket) {
        const [bucket] = await tx
          .insert(fundingBuckets)
          .values({ ...input.createFundingBucket, userId })
          .returning({ id: fundingBuckets.id });
        createdFundingBucketId = bucket.id;
      }

      const [transaction] = await tx
        .insert(transactions)
        .values({
          userId,
          clientRequestId: input.clientRequestId,
          type: input.type,
          status: input.status,
          occurredAt,
          title: input.title,
          payee: input.payee,
          note: input.note,
          parentTransactionId: input.parentTransactionId,
        })
        .returning();

      await tx.insert(transactionEntries).values(
        input.entries.map((entry, sortOrder) => ({
          ...entry,
          userId,
          transactionId: transaction.id,
          categoryId:
            entry.categoryId ??
            (entry.budgetItemId ? (budgetCategoryById.get(entry.budgetItemId) ?? null) : null),
          fundingBucketId: entry.fundingBucketId ?? createdFundingBucketId,
          affectsBalance: !historicalAccountIds.has(entry.accountId),
          sortOrder,
        })),
      );

      return transaction;
    });

    return Response.json({ transaction: created }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
