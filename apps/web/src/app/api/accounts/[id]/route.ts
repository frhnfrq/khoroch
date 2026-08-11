import { auth } from "@clerk/nextjs/server";
import { db } from "@khoroch/db";
import { accounts } from "@khoroch/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

import { conflict, handleRouteError, readJson, unauthorized } from "@/lib/finance/http";
import { updateAccountSchema } from "@/lib/finance/validation";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return unauthorized();

  try {
    const { id } = await context.params;
    const { version, ...changes } = updateAccountSchema.parse(await readJson(request));
    const [account] = await db
      .update(accounts)
      .set({
        ...changes,
        updatedAt: new Date(),
        version: sql`${accounts.version} + 1`,
      })
      .where(
        and(
          eq(accounts.id, id),
          eq(accounts.userId, userId),
          eq(accounts.version, version),
          isNull(accounts.deletedAt),
        ),
      )
      .returning();

    if (!account) return conflict("This account changed elsewhere. Refresh and try again.");
    return Response.json({ account });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return unauthorized();

  const { id } = await context.params;
  const [account] = await db
    .update(accounts)
    .set({ isArchived: true, updatedAt: new Date(), version: sql`${accounts.version} + 1` })
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId), isNull(accounts.deletedAt)))
    .returning({ id: accounts.id });

  if (!account) return Response.json({ error: "Account not found" }, { status: 404 });
  return Response.json({ archived: true });
}
