import assert from "node:assert/strict";
import test from "node:test";

import type { Category } from "@khoroch/db/schema";

import {
  aiQuickEntryStorageKey,
  parseAiQuickEntryDraft,
  resolveAiTransactions,
  type AiExtractedTransaction,
} from "@/lib/finance/ai-quick-entry";

const now = Date.UTC(2026, 8, 1, 12);

function category(
  id: string,
  name: string,
  kind: "expense" | "income",
  parentId: string | null = null,
): Category {
  return {
    id,
    userId: "user-1",
    name,
    kind,
    parentId,
    icon: "circle-dot",
    color: "slate",
    isSystem: false,
    isArchived: false,
    sortOrder: 0,
    version: 1,
    createdAt: new Date(now),
    updatedAt: new Date(now),
    deletedAt: null,
  };
}

const accounts = [
  { id: "cash-id", name: "Cash", type: "cash" as const, currency: "BDT" },
  { id: "redbox-id", name: "Redbox", type: "bank" as const, currency: "BDT" },
  { id: "moneybag-id", name: "Moneybag", type: "mobile_wallet" as const, currency: "BDT" },
];
const categories = [
  category("transport-id", "Transport", "expense"),
  category("income-id", "Gift", "income"),
];

function extracted(overrides: Partial<AiExtractedTransaction>): AiExtractedTransaction {
  return {
    type: "expense",
    title: "Rickshaw",
    amount: 30,
    occurredOn: "2026-08-26",
    accountName: "",
    destinationAccountName: "",
    categoryName: "Transport",
    note: "",
    confidence: "high",
    warnings: [],
    ...overrides,
  };
}

test("resolves defaults, account transfers, and existing categories", () => {
  let id = 0;
  const entries = resolveAiTransactions({
    entries: [
      extracted({}),
      extracted({
        type: "transfer",
        title: "Move to wallet",
        amount: 1700,
        accountName: "redbox",
        destinationAccountName: "MONEYBAG",
        categoryName: "",
      }),
    ],
    accounts,
    categories,
    defaultAccountId: "cash-id",
    defaultDate: "2026-09-01",
    createId: () => `client-id-${++id}`,
  });

  assert.equal(entries[0]?.accountId, "cash-id");
  assert.equal(entries[0]?.categoryId, "transport-id");
  assert.equal(entries[1]?.accountId, "redbox-id");
  assert.equal(entries[1]?.destinationAccountId, "moneybag-id");
  assert.deepEqual(entries[1]?.warnings, []);
});

test("keeps uncertain matches editable and warns instead of inventing ids", () => {
  const [entry] = resolveAiTransactions({
    entries: [
      extracted({
        type: "transfer",
        title: "Withdraw",
        accountName: "Unknown bank",
        destinationAccountName: "Unknown cash box",
        categoryName: "",
        occurredOn: "not-a-date",
        confidence: "low",
      }),
    ],
    accounts,
    categories,
    defaultAccountId: "cash-id",
    defaultDate: "2026-09-01",
    createId: () => "client-id-uncertain",
  });

  assert.equal(entry?.accountId, "cash-id");
  assert.equal(entry?.destinationAccountId, "");
  assert.equal(entry?.occurredOn, "2026-09-01");
  assert.equal(entry?.warnings.length, 3);
});

test("parses current drafts and rejects expired or cross-user assumptions", () => {
  const serialized = JSON.stringify({
    schemaVersion: 1,
    updatedAt: new Date(now).toISOString(),
    kind: "ai-quick-entry",
    stage: "compose",
    sourceText: "Auto 20",
    defaultAccountId: "cash-id",
    entries: [],
  });

  assert.equal(parseAiQuickEntryDraft(serialized, now)?.sourceText, "Auto 20");
  assert.equal(parseAiQuickEntryDraft(serialized, now + 31 * 24 * 60 * 60 * 1_000), null);
  assert.notEqual(aiQuickEntryStorageKey("user-a"), aiQuickEntryStorageKey("user-b"));
});
