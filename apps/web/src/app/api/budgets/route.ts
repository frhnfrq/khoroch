import { auth } from "@clerk/nextjs/server";
import { db } from "@khoroch/db";
import {
  budgetItems,
  budgets,
  categories,
  transactionEntries,
  transactions,
} from "@khoroch/db/schema";
import { and, asc, eq, gte, inArray, isNull, lte, sql, type SQL } from "drizzle-orm";

import {
  ApiInputError,
  conflict,
  handleRouteError,
  readJson,
  unauthorized,
} from "@/lib/finance/http";
import { createBudgetSchema } from "@/lib/finance/validation";
import type { BudgetItemView, BudgetView } from "@/lib/finance/types";

function monthBounds(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new ApiInputError("Month must use YYYY-MM format");
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber || monthNumber < 1 || monthNumber > 12) {
    throw new ApiInputError("Invalid month");
  }

  const start = `${year}-${String(monthNumber).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(year, monthNumber, 0));
  const end = endDate.toISOString().slice(0, 10);
  return { start, end };
}

export async function GET(request: Request) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return unauthorized();

  try {
    const month = new URL(request.url).searchParams.get("month");
    const conditions: SQL[] = [eq(budgets.userId, userId), isNull(budgets.deletedAt)];
    if (month) {
      const { start, end } = monthBounds(month);
      conditions.push(lte(budgets.periodStart, end), gte(budgets.periodEnd, start));
    }

    const budgetRows = await db
      .select()
      .from(budgets)
      .where(and(...conditions))
      .orderBy(asc(budgets.periodStart));

    if (budgetRows.length === 0) return Response.json({ budgets: [] });

    const itemRows = await db
      .select({
        item: budgetItems,
        categoryId: categories.id,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
        directSpent: sql<number>`coalesce(-sum(
          case
            when ${transactions.status} <> 'void'
              and ${transactions.deletedAt} is null
            then ${transactionEntries.amount}
            else 0
          end
        ), 0)`,
      })
      .from(budgetItems)
      .leftJoin(categories, eq(categories.id, budgetItems.categoryId))
      .leftJoin(transactionEntries, eq(transactionEntries.budgetItemId, budgetItems.id))
      .leftJoin(transactions, eq(transactions.id, transactionEntries.transactionId))
      .where(
        and(
          eq(budgetItems.userId, userId),
          inArray(
            budgetItems.budgetId,
            budgetRows.map((budget) => budget.id),
          ),
          isNull(budgetItems.deletedAt),
        ),
      )
      .groupBy(budgetItems.id, categories.id)
      .orderBy(budgetItems.sortOrder, budgetItems.createdAt);

    const itemsByBudget = new Map<string, BudgetItemView[]>();
    for (const row of itemRows) {
      const items = itemsByBudget.get(row.item.budgetId) ?? [];
      const directLedgerSpent = Math.max(0, Number(row.directSpent));
      const directPriorSpent = Number(row.item.priorSpentAmount);
      items.push({
        ...row.item,
        directPlannedAmount: row.item.plannedAmount,
        directPriorSpentAmount: directPriorSpent,
        ledgerSpentAmount: directLedgerSpent,
        spentAmount: directLedgerSpent + directPriorSpent,
        remainingAmount: row.item.plannedAmount - directLedgerSpent - directPriorSpent,
        category: row.categoryId
          ? {
              id: row.categoryId,
              name: row.categoryName ?? "Category",
              icon: row.categoryIcon ?? "circle-dot",
              color: row.categoryColor ?? "slate",
            }
          : null,
      });
      itemsByBudget.set(row.item.budgetId, items);
    }

    const result: BudgetView[] = budgetRows.map((budget) => {
      const items = itemsByBudget.get(budget.id) ?? [];
      const children = new Map<string, BudgetItemView[]>();
      for (const item of items) {
        if (!item.parentId) continue;
        const currentChildren = children.get(item.parentId) ?? [];
        currentChildren.push(item);
        children.set(item.parentId, currentChildren);
      }

      const rollup = (item: BudgetItemView, visited = new Set<string>()): BudgetItemView => {
        if (visited.has(item.id)) return item;
        const nextVisited = new Set(visited).add(item.id);
        const childItems = children.get(item.id) ?? [];
        const rolledChildren = childItems.map((child) => rollup(child, nextVisited));
        const childSpent = rolledChildren.reduce((sum, child) => sum + child.spentAmount, 0);
        const childLedgerSpent = rolledChildren.reduce(
          (sum, child) => sum + child.ledgerSpentAmount,
          0,
        );
        const childPriorSpent = rolledChildren.reduce(
          (sum, child) => sum + child.priorSpentAmount,
          0,
        );
        const childPlanned = rolledChildren.reduce((sum, child) => sum + child.plannedAmount, 0);
        const plannedAmount = Math.max(item.plannedAmount, childPlanned);
        const spentAmount = item.spentAmount + childSpent;
        return {
          ...item,
          plannedAmount,
          priorSpentAmount: item.directPriorSpentAmount + childPriorSpent,
          ledgerSpentAmount: item.ledgerSpentAmount + childLedgerSpent,
          spentAmount,
          remainingAmount: plannedAmount - spentAmount,
        };
      };

      const rolledById = new Map(items.map((item) => [item.id, rollup(item)]));
      const rolledItems = items.map((item) => rolledById.get(item.id) ?? item);
      const rootItems = rolledItems.filter((item) => !item.parentId);
      const plannedAmount = rootItems.reduce((sum, item) => sum + item.plannedAmount, 0);
      const spentAmount = rootItems.reduce((sum, item) => sum + item.spentAmount, 0);

      return {
        ...budget,
        plannedAmount,
        spentAmount,
        remainingAmount: plannedAmount - spentAmount,
        items: rolledItems,
      };
    });

    return Response.json({ budgets: result });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return unauthorized();

  try {
    const input = createBudgetSchema.parse(await readJson(request));
    const clientIds = input.items.map((item) => item.clientId);
    if (new Set(clientIds).size !== clientIds.length) {
      throw new ApiInputError("Budget items contain duplicate identifiers");
    }
    const clientIdSet = new Set(clientIds);
    for (const item of input.items) {
      if (item.parentClientId && !clientIdSet.has(item.parentClientId)) {
        throw new ApiInputError(`“${item.name}” uses an invalid parent item`);
      }
      if (item.parentClientId === item.clientId) {
        throw new ApiInputError(`“${item.name}” cannot be its own parent`);
      }
    }

    const existingBudget = await db.query.budgets.findFirst({
      columns: { id: true },
      where: and(
        eq(budgets.userId, userId),
        eq(budgets.periodStart, input.periodStart),
        eq(budgets.periodEnd, input.periodEnd),
        isNull(budgets.deletedAt),
      ),
    });
    if (existingBudget) return conflict("A budget already exists for this month.");

    const categoryIds = [
      ...new Set(input.items.flatMap((item) => (item.categoryId ? [item.categoryId] : []))),
    ];
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
      if (ownedCategories.some((category) => category.kind !== "expense")) {
        return Response.json(
          { error: "Budget items can only use expense categories" },
          { status: 400 },
        );
      }
    }

    const created = await db.transaction(async (tx) => {
      const [budget] = await tx
        .insert(budgets)
        .values({
          userId,
          name: input.name,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          currency: input.currency,
          rollover: input.rollover,
        })
        .returning();

      const idByClientId = new Map<string, string>();
      let pendingItems = [...input.items];
      let sortOrder = 0;
      while (pendingItems.length > 0) {
        const readyItems = pendingItems.filter(
          (item) => !item.parentClientId || idByClientId.has(item.parentClientId),
        );
        if (readyItems.length === 0)
          throw new ApiInputError("Budget items contain an invalid parent cycle");

        const inserted = await tx
          .insert(budgetItems)
          .values(
            readyItems.map((item) => ({
              userId,
              budgetId: budget.id,
              categoryId: item.categoryId,
              parentId: item.parentClientId
                ? (idByClientId.get(item.parentClientId) ?? null)
                : null,
              name: item.name,
              plannedAmount: item.plannedAmount,
              priorSpentAmount: item.priorSpentAmount,
              sortOrder: sortOrder++,
            })),
          )
          .returning({ id: budgetItems.id });

        readyItems.forEach((item, index) => idByClientId.set(item.clientId, inserted[index].id));
        const readyIds = new Set(readyItems.map((item) => item.clientId));
        pendingItems = pendingItems.filter((item) => !readyIds.has(item.clientId));
      }

      return budget;
    });

    return Response.json({ budget: created }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
