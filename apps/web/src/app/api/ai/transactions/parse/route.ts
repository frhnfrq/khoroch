import { auth } from "@clerk/nextjs/server";
import { db } from "@khoroch/db";
import { accounts, categories } from "@khoroch/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { NoObjectGeneratedError } from "ai";
import { z } from "zod";

import { resolveAiTransactions } from "@/lib/finance/ai-quick-entry";
import { extractAiTransactions } from "@/lib/finance/ai-quick-entry.server";
import { getCategoryPath } from "@/lib/finance/category-tree";
import { handleRouteError, readJson, unauthorized } from "@/lib/finance/http";

const parseRequestSchema = z.object({
  text: z.string().trim().min(1, "Paste at least one expense or transfer").max(20_000),
  defaultAccountId: z.uuid(),
  today: z.iso.date(),
  timeZone: z.string().trim().min(1).max(100),
});

export const maxDuration = 180;

export async function POST(request: Request) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return unauthorized();

  try {
    const input = parseRequestSchema.parse(await readJson(request));
    const [ownedAccounts, ownedCategories] = await Promise.all([
      db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.userId, userId),
            eq(accounts.isArchived, false),
            isNull(accounts.deletedAt),
          ),
        )
        .orderBy(accounts.sortOrder, accounts.createdAt),
      db
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.userId, userId),
            eq(categories.isArchived, false),
            isNull(categories.deletedAt),
          ),
        )
        .orderBy(categories.kind, categories.sortOrder, categories.name),
    ]);
    const defaultAccount = ownedAccounts.find((account) => account.id === input.defaultAccountId);
    if (!defaultAccount) {
      return Response.json({ error: "Choose an active default account" }, { status: 400 });
    }

    const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
    if (!apiKey) {
      return Response.json(
        {
          error:
            "AI quick entry is not configured yet. Add AI_GATEWAY_API_KEY to the web app environment.",
        },
        { status: 503 },
      );
    }
    const modelId = process.env.AI_TRANSACTION_MODEL?.trim() || "google/gemma-4-31b-it";

    const extractedEntries = await extractAiTransactions({
      apiKey,
      modelId,
      text: input.text,
      today: input.today,
      timeZone: input.timeZone,
      defaultAccountName: defaultAccount.name,
      accountOptions: ownedAccounts.map((account) => ({
        name: account.name,
        type: account.type,
        currency: account.currency,
      })),
      categoryOptions: ownedCategories.map((category) => ({
        name: getCategoryPath(category, ownedCategories),
        kind: category.kind,
      })),
    });

    const entries = resolveAiTransactions({
      entries: extractedEntries,
      accounts: ownedAccounts,
      categories: ownedCategories,
      defaultAccountId: defaultAccount.id,
      defaultDate: input.today,
      createId: () => crypto.randomUUID(),
    });

    return Response.json({ entries, model: modelId });
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      console.error("AI transaction extraction returned invalid structured data", error.cause);
      return Response.json(
        {
          error: "The notes could not be interpreted reliably. Try simplifying the unclear lines.",
        },
        { status: 422 },
      );
    }
    return handleRouteError(error);
  }
}
