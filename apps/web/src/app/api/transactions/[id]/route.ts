import { auth } from "@clerk/nextjs/server";
import { db } from "@khoroch/db";
import { transactions } from "@khoroch/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

import { unauthorized } from "@/lib/finance/http";

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
