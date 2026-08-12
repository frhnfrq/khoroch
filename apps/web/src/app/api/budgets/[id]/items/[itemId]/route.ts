import { auth } from "@clerk/nextjs/server";
import { db } from "@khoroch/db";
import { budgetItems, budgets, categories } from "@khoroch/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

import { wouldCreateBudgetItemCycle } from "@/lib/finance/budget-item-parent";
import {
  ApiConflictError,
  ApiInputError,
  handleRouteError,
  notFound,
  readJson,
  unauthorized,
} from "@/lib/finance/http";
import { updateBudgetItemSchema } from "@/lib/finance/validation";

type BudgetItemRouteContext = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(request: Request, context: BudgetItemRouteContext) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return unauthorized();

  try {
    const { id: budgetId, itemId } = await context.params;
    const input = updateBudgetItemSchema.parse(await readJson(request));

    const [budget, item, activeItems, category] = await Promise.all([
      db.query.budgets.findFirst({
        columns: { id: true },
        where: and(eq(budgets.id, budgetId), eq(budgets.userId, userId), isNull(budgets.deletedAt)),
      }),
      db.query.budgetItems.findFirst({
        columns: { id: true },
        where: and(
          eq(budgetItems.id, itemId),
          eq(budgetItems.userId, userId),
          eq(budgetItems.budgetId, budgetId),
          isNull(budgetItems.deletedAt),
        ),
      }),
      db
        .select({ id: budgetItems.id, parentId: budgetItems.parentId })
        .from(budgetItems)
        .where(
          and(
            eq(budgetItems.userId, userId),
            eq(budgetItems.budgetId, budgetId),
            isNull(budgetItems.deletedAt),
          ),
        ),
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
    ]);

    if (!budget) return notFound("Budget not found");
    if (!item) return notFound("Budget item not found");
    if (input.categoryId && (!category || category.kind !== "expense" || category.isArchived)) {
      throw new ApiInputError("Choose one of your active expense categories");
    }
    if (input.parentId && !activeItems.some((candidate) => candidate.id === input.parentId)) {
      throw new ApiInputError("Choose an active parent item from this budget");
    }
    if (wouldCreateBudgetItemCycle(activeItems, itemId, input.parentId)) {
      throw new ApiInputError("A budget item cannot be moved under itself or one of its sub-items");
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

      const [updatedItem] = await tx
        .update(budgetItems)
        .set({
          categoryId: input.categoryId,
          parentId: input.parentId,
          name: input.name,
          plannedAmount: input.plannedAmount,
          priorSpentAmount: input.priorSpentAmount,
          updatedAt: new Date(),
          version: sql`${budgetItems.version} + 1`,
        })
        .where(
          and(
            eq(budgetItems.id, itemId),
            eq(budgetItems.userId, userId),
            eq(budgetItems.budgetId, budgetId),
            eq(budgetItems.version, input.version),
            isNull(budgetItems.deletedAt),
          ),
        )
        .returning();
      if (!updatedItem) {
        throw new ApiConflictError("This budget item changed elsewhere. Refresh and try again.");
      }

      return { budgetVersion: updatedBudget.version, item: updatedItem };
    });

    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
