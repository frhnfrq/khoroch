import { auth } from "@clerk/nextjs/server";
import { db } from "@khoroch/db";
import { budgetItems, budgets, categories } from "@khoroch/db/schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import {
  ApiConflictError,
  ApiInputError,
  handleRouteError,
  notFound,
  readJson,
  unauthorized,
} from "@/lib/finance/http";
import { deleteBudgetSchema, updateBudgetSchema } from "@/lib/finance/validation";

type BudgetRouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: BudgetRouteContext) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return unauthorized();

  try {
    const { id: budgetId } = await context.params;
    const input = updateBudgetSchema.parse(await readJson(request));

    const budget = await db.query.budgets.findFirst({
      columns: { id: true },
      where: and(eq(budgets.id, budgetId), eq(budgets.userId, userId), isNull(budgets.deletedAt)),
    });
    if (!budget) return notFound("Budget not found");

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

    const existingItems = await db
      .select({ id: budgetItems.id, version: budgetItems.version })
      .from(budgetItems)
      .where(
        and(
          eq(budgetItems.userId, userId),
          eq(budgetItems.budgetId, budgetId),
          isNull(budgetItems.deletedAt),
        ),
      );
    const existingById = new Map(existingItems.map((item) => [item.id, item]));
    const suppliedIds = input.items.flatMap((item) => (item.id ? [item.id] : []));
    if (new Set(suppliedIds).size !== suppliedIds.length) {
      throw new ApiInputError("A budget item was included more than once");
    }
    if (suppliedIds.some((itemId) => !existingById.has(itemId))) {
      throw new ApiInputError("One or more budget items do not belong to this budget");
    }

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
      if (
        ownedCategories.length !== categoryIds.length ||
        ownedCategories.some((category) => category.kind !== "expense")
      ) {
        throw new ApiInputError("Budget items can only use your active expense categories");
      }
    }

    const updatedBudget = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(budgets)
        .set({
          name: input.name,
          rollover: input.rollover,
          updatedAt: new Date(),
          version: sql`${budgets.version} + 1`,
        })
        .where(
          and(
            eq(budgets.id, budgetId),
            eq(budgets.userId, userId),
            eq(budgets.version, input.version),
            isNull(budgets.deletedAt),
          ),
        )
        .returning();
      if (!updated) {
        throw new ApiConflictError("This budget changed elsewhere. Refresh and try again.");
      }

      const suppliedIdSet = new Set(suppliedIds);
      const removedIds = existingItems
        .filter((item) => !suppliedIdSet.has(item.id))
        .map((item) => item.id);
      if (removedIds.length > 0) {
        await tx
          .update(budgetItems)
          .set({
            deletedAt: new Date(),
            updatedAt: new Date(),
            version: sql`${budgetItems.version} + 1`,
          })
          .where(
            and(
              eq(budgetItems.userId, userId),
              eq(budgetItems.budgetId, budgetId),
              inArray(budgetItems.id, removedIds),
              isNull(budgetItems.deletedAt),
            ),
          );
      }

      const sortOrderByClientId = new Map(
        input.items.map((item, sortOrder) => [item.clientId, sortOrder]),
      );
      const idByClientId = new Map<string, string>();
      let pendingItems = [...input.items];
      while (pendingItems.length > 0) {
        const readyItems = pendingItems.filter(
          (item) => !item.parentClientId || idByClientId.has(item.parentClientId),
        );
        if (readyItems.length === 0) {
          throw new ApiInputError("Budget item parents contain a cycle");
        }

        for (const item of readyItems) {
          const values = {
            categoryId: item.categoryId,
            parentId: item.parentClientId ? (idByClientId.get(item.parentClientId) ?? null) : null,
            name: item.name,
            plannedAmount: item.plannedAmount,
            priorSpentAmount: item.priorSpentAmount,
            sortOrder: sortOrderByClientId.get(item.clientId) ?? 0,
            updatedAt: new Date(),
          };

          let itemId: string;
          if (item.id && item.version) {
            const [savedItem] = await tx
              .update(budgetItems)
              .set({ ...values, version: sql`${budgetItems.version} + 1` })
              .where(
                and(
                  eq(budgetItems.id, item.id),
                  eq(budgetItems.userId, userId),
                  eq(budgetItems.budgetId, budgetId),
                  eq(budgetItems.version, item.version),
                  isNull(budgetItems.deletedAt),
                ),
              )
              .returning({ id: budgetItems.id });
            if (!savedItem) {
              throw new ApiConflictError(
                `“${item.name}” changed elsewhere. Refresh and try again.`,
              );
            }
            itemId = savedItem.id;
          } else {
            const [savedItem] = await tx
              .insert(budgetItems)
              .values({ ...values, userId, budgetId })
              .returning({ id: budgetItems.id });
            itemId = savedItem.id;
          }
          idByClientId.set(item.clientId, itemId);
        }

        const readyClientIds = new Set(readyItems.map((item) => item.clientId));
        pendingItems = pendingItems.filter((item) => !readyClientIds.has(item.clientId));
      }

      return updated;
    });

    return Response.json({ budget: updatedBudget });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: BudgetRouteContext) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return unauthorized();

  try {
    const { id: budgetId } = await context.params;
    const input = deleteBudgetSchema.parse(await readJson(request));
    const existing = await db.query.budgets.findFirst({
      columns: { id: true },
      where: and(eq(budgets.id, budgetId), eq(budgets.userId, userId), isNull(budgets.deletedAt)),
    });
    if (!existing) return notFound("Budget not found");

    await db.transaction(async (tx) => {
      const [deleted] = await tx
        .update(budgets)
        .set({
          status: "archived",
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: sql`${budgets.version} + 1`,
        })
        .where(
          and(
            eq(budgets.id, budgetId),
            eq(budgets.userId, userId),
            eq(budgets.version, input.version),
            isNull(budgets.deletedAt),
          ),
        )
        .returning({ id: budgets.id });
      if (!deleted) {
        throw new ApiConflictError("This budget changed elsewhere. Refresh and try again.");
      }

      await tx
        .update(budgetItems)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: sql`${budgetItems.version} + 1`,
        })
        .where(
          and(
            eq(budgetItems.userId, userId),
            eq(budgetItems.budgetId, budgetId),
            isNull(budgetItems.deletedAt),
          ),
        );
    });

    return Response.json({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
