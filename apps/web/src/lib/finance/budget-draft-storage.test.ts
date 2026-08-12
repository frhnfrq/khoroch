import assert from "node:assert/strict";
import test from "node:test";

import { budgetDraftStorageKey, parseBudgetDraft } from "@/lib/finance/budget-draft-storage";

const now = Date.UTC(2026, 7, 12, 12);
const line = {
  clientId: "line-1",
  name: "Groceries",
  plannedAmount: "5000",
  priorSpentAmount: "1000",
  hasPriorSpending: true,
  categoryId: "category-1",
  parentClientId: "",
};

test("parses a current create-budget draft", () => {
  const draft = parseBudgetDraft(
    JSON.stringify({
      schemaVersion: 1,
      kind: "create-budget",
      updatedAt: new Date(now).toISOString(),
      budgetMonth: "2026-08",
      name: "August budget",
      lines: [line],
    }),
    "create-budget",
    now,
  );

  assert.equal(draft?.kind, "create-budget");
  assert.equal(draft?.lines[0]?.name, "Groceries");
});

test("rejects expired, malformed, and mismatched drafts", () => {
  const oldDraft = JSON.stringify({
    schemaVersion: 1,
    kind: "create-budget",
    updatedAt: new Date(now - 31 * 24 * 60 * 60 * 1000).toISOString(),
    budgetMonth: "2026-08",
    name: "Old draft",
    lines: [line],
  });

  assert.equal(parseBudgetDraft(oldDraft, "create-budget", now), null);
  assert.equal(parseBudgetDraft("not-json", "create-budget", now), null);
  assert.equal(
    parseBudgetDraft(
      JSON.stringify({
        schemaVersion: 1,
        kind: "create-budget",
        updatedAt: new Date(now).toISOString(),
        budgetMonth: "2026-13",
        name: "Invalid month",
        lines: [line],
      }),
      "create-budget",
      now,
    ),
    null,
  );
  assert.equal(
    parseBudgetDraft(
      JSON.stringify({
        schemaVersion: 1,
        kind: "create-budget",
        updatedAt: new Date(now).toISOString(),
        budgetMonth: "2026-08",
        name: "Wrong kind",
        lines: [line],
      }),
      "manage-budget",
      now,
    ),
    null,
  );
});

test("scopes storage keys by signed-in user and budget", () => {
  const createKeyA = budgetDraftStorageKey("user:a", { kind: "create-budget" });
  const createKeyB = budgetDraftStorageKey("user:b", { kind: "create-budget" });
  const manageKey = budgetDraftStorageKey("user:a", {
    kind: "manage-budget",
    budgetId: "budget:1",
  });

  assert.notEqual(createKeyA, createKeyB);
  assert.notEqual(createKeyA, manageKey);
  assert.match(createKeyA, /user%3Aa/);
  assert.match(manageKey, /budget%3A1/);
});
