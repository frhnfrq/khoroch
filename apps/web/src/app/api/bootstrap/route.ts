import { auth } from "@clerk/nextjs/server";
import { db } from "@khoroch/db";
import { categories } from "@khoroch/db/schema";

import { unauthorized } from "@/lib/finance/http";

const defaultCategories = [
  { name: "Housing", kind: "expense", icon: "house", color: "violet" },
  { name: "Food", kind: "expense", icon: "utensils", color: "orange" },
  { name: "Transport", kind: "expense", icon: "bus-front", color: "blue" },
  { name: "Bills", kind: "expense", icon: "receipt-text", color: "amber" },
  { name: "Shopping", kind: "expense", icon: "shopping-bag", color: "pink" },
  { name: "Health", kind: "expense", icon: "heart-pulse", color: "rose" },
  { name: "Pets", kind: "expense", icon: "paw-print", color: "cyan" },
  { name: "Family", kind: "expense", icon: "users", color: "fuchsia" },
  { name: "Giving", kind: "expense", icon: "hand-heart", color: "emerald" },
  { name: "Entertainment", kind: "expense", icon: "clapperboard", color: "indigo" },
  { name: "Subscriptions", kind: "expense", icon: "repeat-2", color: "sky" },
  { name: "Travel", kind: "expense", icon: "plane", color: "teal" },
  { name: "Fees", kind: "expense", icon: "badge-cent", color: "slate" },
  { name: "Other", kind: "expense", icon: "ellipsis", color: "slate" },
  { name: "Salary", kind: "income", icon: "briefcase-business", color: "emerald" },
  { name: "Freelance", kind: "income", icon: "laptop", color: "cyan" },
  { name: "Bonus", kind: "income", icon: "sparkles", color: "amber" },
  { name: "Gift", kind: "income", icon: "gift", color: "pink" },
  { name: "Refund", kind: "income", icon: "rotate-ccw", color: "blue" },
  { name: "Other income", kind: "income", icon: "circle-plus", color: "slate" },
] as const;

export async function POST() {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return unauthorized();

  await db
    .insert(categories)
    .values(
      defaultCategories.map((category, sortOrder) => ({
        ...category,
        userId,
        isSystem: true,
        sortOrder,
      })),
    )
    .onConflictDoNothing();

  return Response.json({ ready: true });
}
