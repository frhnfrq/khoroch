import { auth } from "@clerk/nextjs/server";
import { db } from "@khoroch/db";
import { budgetItems, budgets, categories } from "@khoroch/db/schema";
import { and, count, eq, isNull, max, sql } from "drizzle-orm";

import {
  ApiConflictError,
  ApiInputError,
  handleRouteError,
  notFound,
  readJson,
  unauthorized,
} from "@/lib/finance/http";
import { createBudgetItemSchema } from "@/lib/finance/validation";

type BudgetItemsRouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: BudgetItemsRouteContext) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return unauthorized();

  try {
    const { id: budgetId } = await context.params;
    const input = createBudgetItemSchema.parse(await readJson(request));

    const [budget, category, parent] = await Promise.all([
      db.query.budgets.findFirst({
        columns: { id: true },
        where: and(eq(budgets.id, budgetId), eq(budgets.userId, userId), isNull(budgets.deletedAt)),
      }),
      input.categoryId
        ? db.query.categories.findFirst({
            columns: { id: true, kind: true, isArchived: true },
            where: and(
              eq(categories.id, input.categoryId),
              eq(categories.userId, userId),
              isNull(categories.deletedAt),
            ),
          })
        : Promise.resolve(null),
      input.parentId
        ? db.query.budgetItems.findFirst({
            columns: { id: true },
            where: and(
              eq(budgetItems.id, input.parentId),
              eq(budgetItems.userId, userId),
              eq(budgetItems.budgetId, budgetId),
              isNull(budgetItems.deletedAt),
            ),
          })
        : Promise.resolve(null),
    ]);

    if (!budget) return notFound("Budget not found");
    if (input.categoryId && (!category || category.kind !== "expense" || category.isArchived)) {
      throw new ApiInputError("Choose one of your active expense categories");
    }
    if (input.parentId && !parent) {
      throw new ApiInputError("Choose an active parent item from this budget");
    }

    const result = await db.transaction(async (tx) => {
      const [updatedBudget] = await tx
        .update(budgets)
        .set({
          updatedAt: new Date(),
          version: sql`${budgets.version} + 1`,
        })
        .where(
          and(
            eq(budgets.id, budgetId),
            eq(budgets.userId, userId),
            eq(budgets.version, input.budgetVersion),
            isNull(budgets.deletedAt),
          ),
        )
        .returning({ version: budgets.version });
      if (!updatedBudget) {
        throw new ApiConflictError("This budget changed elsewhere. Refresh and try again.");
      }

      const [summary] = await tx
        .select({
          itemCount: count(),
          maxSortOrder: max(budgetItems.sortOrder),
        })
        .from(budgetItems)
        .where(
          and(
            eq(budgetItems.userId, userId),
            eq(budgetItems.budgetId, budgetId),
            isNull(budgetItems.deletedAt),
          ),
        );
      if (Number(summary?.itemCount ?? 0) >= 100) {
        throw new ApiInputError("A budget can contain up to 100 items");
      }

      const [item] = await tx
        .insert(budgetItems)
        .values({
          userId,
          budgetId,
          categoryId: input.categoryId,
          parentId: input.parentId,
          name: input.name,
          plannedAmount: input.plannedAmount,
          priorSpentAmount: input.priorSpentAmount,
          sortOrder: Number(summary?.maxSortOrder ?? -1) + 1,
        })
        .returning();

      return { budgetVersion: updatedBudget.version, item };
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
