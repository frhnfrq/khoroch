import { auth } from "@clerk/nextjs/server";
import { db } from "@khoroch/db";
import { accounts, transactionEntries, transactions } from "@khoroch/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

import { handleRouteError, readJson, unauthorized } from "@/lib/finance/http";
import { createAccountSchema } from "@/lib/finance/validation";

export async function GET() {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return unauthorized();

  const rows = await db
    .select({
      account: accounts,
      ledgerBalance: sql<number>`coalesce(sum(
        case
          when ${transactions.status} <> 'void'
            and ${transactions.deletedAt} is null
            and ${transactionEntries.affectsBalance} = true
          then ${transactionEntries.amount}
          else 0
        end
      ), 0)`,
    })
    .from(accounts)
    .leftJoin(
      transactionEntries,
      and(eq(transactionEntries.accountId, accounts.id), eq(transactionEntries.userId, userId)),
    )
    .leftJoin(
      transactions,
      and(eq(transactions.id, transactionEntries.transactionId), eq(transactions.userId, userId)),
    )
    .where(and(eq(accounts.userId, userId), isNull(accounts.deletedAt)))
    .groupBy(accounts.id)
    .orderBy(accounts.sortOrder, accounts.createdAt);

  return Response.json({
    accounts: rows.map(({ account, ledgerBalance }) => ({
      ...account,
      balance: account.openingBalance + Number(ledgerBalance),
    })),
  });
}

export async function POST(request: Request) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return unauthorized();

  try {
    const input = createAccountSchema.parse(await readJson(request));
    const [account] = await db
      .insert(accounts)
      .values({ ...input, userId })
      .returning();

    return Response.json(
      { account: { ...account, balance: account.openingBalance } },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
