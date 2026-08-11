import { auth } from "@clerk/nextjs/server";
import { db } from "@khoroch/db";
import { userPreferences } from "@khoroch/db/schema";
import { and, eq, sql } from "drizzle-orm";

import { conflict, handleRouteError, readJson, unauthorized } from "@/lib/finance/http";
import { updateUserPreferencesSchema } from "@/lib/finance/validation";

export async function GET() {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return unauthorized();

  const settings = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
  });

  return Response.json({
    settings: settings ?? {
      userId,
      defaultCurrency: "BDT",
      version: 1,
      createdAt: null,
      updatedAt: null,
    },
  });
}

export async function PATCH(request: Request) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return unauthorized();

  try {
    const input = updateUserPreferencesSchema.parse(await readJson(request));
    const existing = await db.query.userPreferences.findFirst({
      columns: { version: true },
      where: eq(userPreferences.userId, userId),
    });

    if (!existing) {
      const [settings] = await db
        .insert(userPreferences)
        .values({ userId, defaultCurrency: input.defaultCurrency })
        .returning();
      return Response.json({ settings });
    }

    if (input.version && input.version !== existing.version) {
      return conflict("Settings changed in another session. Refresh and try again.");
    }

    const [settings] = await db
      .update(userPreferences)
      .set({
        defaultCurrency: input.defaultCurrency,
        updatedAt: new Date(),
        version: sql`${userPreferences.version} + 1`,
      })
      .where(and(eq(userPreferences.userId, userId), eq(userPreferences.version, existing.version)))
      .returning();

    if (!settings) return conflict("Settings changed in another session. Refresh and try again.");
    return Response.json({ settings });
  } catch (error) {
    return handleRouteError(error);
  }
}
