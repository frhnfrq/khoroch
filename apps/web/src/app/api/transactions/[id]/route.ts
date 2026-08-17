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
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { occurredBeforeBalanceTracking } from "@/lib/finance/balance-tracking";
import { handleRouteError, readJson, unauthorized } from "@/lib/finance/http";
import { updateTransactionSchema } from "@/lib/finance/validation";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return unauthorized();

  try {
    const { id } = await context.params;
    const input = updateTransactionSchema.parse(await readJson(request));
    const existing = await db.query.transactions.findFirst({
      columns: { id: true, version: true },
      where: and(
        eq(transactions.id, id),
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
      ),
    });

    if (!existing) return Response.json({ error: "Transaction not found" }, { status: 404 });
    if (existing.version !== input.version) {
      return Response.json(
        { error: "This activity changed since you opened it. Reopen it and try again." },
        { status: 409 },
      );
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
    if (historicalAccountIds.size > 0 && input.entries.some((entry) => entry.fundingBucketId)) {
      return Response.json(
        { error: "Historical activity cannot use an income funding bucket" },
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
      for (const category of ownedCategories) categoryKindById.set(category.id, category.kind);
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
      if (input.parentTransactionId === id) {
        return Response.json({ error: "An activity cannot be related to itself" }, { status: 400 });
      }
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

    const updated = await db.transaction(async (tx) => {
      const [transaction] = await tx
        .update(transactions)
        .set({
          type: input.type,
          status: input.status,
          occurredAt,
          title: input.title,
          payee: input.payee,
          note: input.note,
          parentTransactionId: input.parentTransactionId,
          updatedAt: new Date(),
          version: sql`${transactions.version} + 1`,
        })
        .where(
          and(
            eq(transactions.id, id),
            eq(transactions.userId, userId),
            eq(transactions.version, input.version),
            isNull(transactions.deletedAt),
          ),
        )
        .returning();

      if (!transaction) return null;

      await tx
        .delete(transactionEntries)
        .where(
          and(eq(transactionEntries.transactionId, id), eq(transactionEntries.userId, userId)),
        );
      await tx.insert(transactionEntries).values(
        input.entries.map((entry, sortOrder) => ({
          ...entry,
          userId,
          transactionId: id,
          categoryId:
            entry.categoryId ??
            (entry.budgetItemId ? (budgetCategoryById.get(entry.budgetItemId) ?? null) : null),
          affectsBalance: !historicalAccountIds.has(entry.accountId),
          sortOrder,
        })),
      );

      return transaction;
    });

    if (!updated) {
      return Response.json(
        { error: "This activity changed while you were editing it. Reopen it and try again." },
        { status: 409 },
      );
    }
    return Response.json({ transaction: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return unauthorized();

  const { id } = await context.params;
  const [transaction] = await db
    .update(transactions)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
      version: sql`${transactions.version} + 1`,
    })
    .where(
      and(eq(transactions.id, id), eq(transactions.userId, userId), isNull(transactions.deletedAt)),
    )
    .returning({ id: transactions.id });

  if (!transaction) return Response.json({ error: "Transaction not found" }, { status: 404 });
  return Response.json({ deleted: true });
}
