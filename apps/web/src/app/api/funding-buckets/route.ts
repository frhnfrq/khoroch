import { auth } from "@clerk/nextjs/server";
import { db } from "@khoroch/db";
import { fundingBuckets, transactionEntries, transactions } from "@khoroch/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

import { handleRouteError, readJson, unauthorized } from "@/lib/finance/http";
import { createFundingBucketSchema } from "@/lib/finance/validation";

export async function GET() {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return unauthorized();

  const rows = await db
    .select({
      bucket: fundingBuckets,
      fundedAmount: sql<number>`coalesce(sum(
        case
          when ${transactions.status} <> 'void'
            and ${transactions.deletedAt} is null
            and ${transactionEntries.amount} > 0
          then ${transactionEntries.amount}
          else 0
        end
      ), 0)`,
      spentAmount: sql<number>`coalesce(-sum(
        case
          when ${transactions.status} <> 'void'
            and ${transactions.deletedAt} is null
            and ${transactionEntries.amount} < 0
          then ${transactionEntries.amount}
          else 0
        end
      ), 0)`,
    })
    .from(fundingBuckets)
    .leftJoin(
      transactionEntries,
      and(
        eq(transactionEntries.fundingBucketId, fundingBuckets.id),
        eq(transactionEntries.userId, userId),
      ),
    )
    .leftJoin(
      transactions,
      and(eq(transactions.id, transactionEntries.transactionId), eq(transactions.userId, userId)),
    )
    .where(and(eq(fundingBuckets.userId, userId), isNull(fundingBuckets.deletedAt)))
    .groupBy(fundingBuckets.id)
    .orderBy(fundingBuckets.createdAt);

  return Response.json({
    fundingBuckets: rows.map(({ bucket, fundedAmount, spentAmount }) => ({
      ...bucket,
      fundedAmount: Number(fundedAmount),
      spentAmount: Number(spentAmount),
      remainingAmount: Number(fundedAmount) - Number(spentAmount),
    })),
  });
}

export async function POST(request: Request) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return unauthorized();

  try {
    const input = createFundingBucketSchema.parse(await readJson(request));
    const [bucket] = await db
      .insert(fundingBuckets)
      .values({ ...input, userId })
      .returning();
    return Response.json({ fundingBucket: bucket }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
