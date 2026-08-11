import { auth } from "@clerk/nextjs/server";
import { db } from "@khoroch/db";
import { categories } from "@khoroch/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

import { conflict, handleRouteError, readJson, unauthorized } from "@/lib/finance/http";
import { createCategorySchema } from "@/lib/finance/validation";

export async function GET() {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return unauthorized();

  const rows = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), isNull(categories.deletedAt)))
    .orderBy(categories.kind, categories.sortOrder, categories.name);

  return Response.json({ categories: rows });
}

export async function POST(request: Request) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return unauthorized();

  try {
    const input = createCategorySchema.parse(await readJson(request));

    if (input.parentId) {
      const parent = await db.query.categories.findFirst({
        columns: { id: true, kind: true },
        where: and(
          eq(categories.id, input.parentId),
          eq(categories.userId, userId),
          isNull(categories.deletedAt),
        ),
      });
      if (!parent || parent.kind !== input.kind) {
        return Response.json({ error: "Invalid parent category" }, { status: 400 });
      }
    }

    const duplicate = await db.query.categories.findFirst({
      columns: { id: true },
      where: and(
        eq(categories.userId, userId),
        eq(categories.kind, input.kind),
        input.parentId ? eq(categories.parentId, input.parentId) : isNull(categories.parentId),
        sql`lower(${categories.name}) = lower(${input.name})`,
        isNull(categories.deletedAt),
      ),
    });
    if (duplicate) return conflict(`“${input.name}” already exists at this category level.`);

    const [category] = await db
      .insert(categories)
      .values({ ...input, userId })
      .returning();

    return Response.json({ category }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
