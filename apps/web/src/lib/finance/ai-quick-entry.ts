import type { Account, Category } from "@khoroch/db/schema";
import { z } from "zod";

import { getCategoryPath } from "@/lib/finance/category-tree";

export const aiTransactionTypes = ["expense", "income", "transfer"] as const;

export const aiExtractionSchema = z.object({
  entries: z
    .array(
      z.object({
        type: z.enum(aiTransactionTypes),
        title: z.string().trim().min(1).max(120),
        amount: z.number().finite().positive(),
        occurredOn: z.string().trim().max(10),
        accountName: z.string().trim().max(80),
        destinationAccountName: z.string().trim().max(80),
        categoryName: z.string().trim().max(160),
        note: z.string().trim().max(1_000),
        confidence: z.enum(["high", "medium", "low"]),
        warnings: z.array(z.string().trim().min(1).max(240)).max(5),
      }),
    )
    .min(1)
    .max(100),
});

export type AiExtractedTransaction = z.infer<typeof aiExtractionSchema>["entries"][number];
export type AiTransactionType = (typeof aiTransactionTypes)[number];
export type AiConfidence = AiExtractedTransaction["confidence"];

export type AiQuickEntryItem = {
  clientId: string;
  type: AiTransactionType;
  title: string;
  amount: string;
  occurredOn: string;
  accountId: string;
  destinationAccountId: string;
  categoryId: string;
  note: string;
  confidence: AiConfidence;
  warnings: string[];
};

export type AiQuickEntryDraftInput = {
  kind: "ai-quick-entry";
  stage: "compose" | "review";
  sourceText: string;
  defaultAccountId: string;
  entries: AiQuickEntryItem[];
};

export type AiQuickEntryDraft = AiQuickEntryDraftInput & {
  schemaVersion: 1;
  updatedAt: string;
};

type AccountOption = Pick<Account, "id" | "name" | "type" | "currency">;

function normalizeLookup(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function findAccount(accounts: AccountOption[], name: string) {
  const normalized = normalizeLookup(name);
  if (!normalized) return null;
  return accounts.find((account) => normalizeLookup(account.name) === normalized) ?? null;
}

function findCategory(categories: Category[], name: string, kind: Category["kind"]) {
  const normalized = normalizeLookup(name);
  if (!normalized) return null;

  const candidates = categories.filter(
    (category) => category.kind === kind && !category.isArchived,
  );
  const pathMatch = candidates.find(
    (category) => normalizeLookup(getCategoryPath(category, categories)) === normalized,
  );
  if (pathMatch) return pathMatch;

  const leafMatches = candidates.filter(
    (category) => normalizeLookup(category.name) === normalized,
  );
  return leafMatches.length === 1 ? leafMatches[0] : null;
}

function validDateOrDefault(value: string, defaultDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return defaultDate;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? value
    : defaultDate;
}

export function resolveAiTransactions({
  entries,
  accounts,
  categories,
  defaultAccountId,
  defaultDate,
  createId,
}: {
  entries: AiExtractedTransaction[];
  accounts: AccountOption[];
  categories: Category[];
  defaultAccountId: string;
  defaultDate: string;
  createId: () => string;
}): AiQuickEntryItem[] {
  const defaultAccount = accounts.find((account) => account.id === defaultAccountId) ?? null;

  return entries.map((entry) => {
    const warnings = [...entry.warnings];
    const matchedAccount = findAccount(accounts, entry.accountName);
    const account = matchedAccount ?? defaultAccount;
    if (entry.accountName && !matchedAccount) {
      warnings.push(`Could not match account “${entry.accountName}”; using the default account.`);
    }

    const destinationAccount =
      entry.type === "transfer" ? findAccount(accounts, entry.destinationAccountName) : null;
    if (entry.type === "transfer" && !destinationAccount) {
      warnings.push(
        entry.destinationAccountName
          ? `Could not match destination “${entry.destinationAccountName}”.`
          : "Choose a destination account for this transfer.",
      );
    }

    const categoryKind = entry.type === "income" ? "income" : "expense";
    const category =
      entry.type === "transfer" ? null : findCategory(categories, entry.categoryName, categoryKind);
    if (entry.type !== "transfer" && entry.categoryName && !category) {
      warnings.push(`Could not match category “${entry.categoryName}”.`);
    }

    const occurredOn = validDateOrDefault(entry.occurredOn, defaultDate);
    if (occurredOn !== entry.occurredOn) {
      warnings.push(`Date was unclear, so ${defaultDate} was used.`);
    }

    return {
      clientId: createId(),
      type: entry.type,
      title: entry.title,
      amount: String(Math.round(entry.amount * 100) / 100),
      occurredOn,
      accountId: account?.id ?? "",
      destinationAccountId: destinationAccount?.id ?? "",
      categoryId: category?.id ?? "",
      note: entry.note,
      confidence: entry.confidence,
      warnings: [...new Set(warnings)],
    };
  });
}

export function aiQuickEntryStorageKey(userId: string) {
  return `khoroch:ai-quick-entry:v1:${encodeURIComponent(userId)}`;
}

export function hasAiQuickEntryData(draft: AiQuickEntryDraftInput) {
  return Boolean(draft.sourceText.trim() || draft.entries.length > 0);
}

export function parseAiQuickEntryDraft(serialized: string, now = Date.now()) {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    return null;
  }

  const schema = z.object({
    schemaVersion: z.literal(1),
    updatedAt: z.iso.datetime({ offset: true }),
    kind: z.literal("ai-quick-entry"),
    stage: z.enum(["compose", "review"]),
    sourceText: z.string().max(20_000),
    defaultAccountId: z.string().max(200),
    entries: z
      .array(
        z.object({
          clientId: z.string().min(8).max(200),
          type: z.enum(aiTransactionTypes),
          title: z.string().max(120),
          amount: z.string().max(100),
          occurredOn: z.string().max(10),
          accountId: z.string().max(200),
          destinationAccountId: z.string().max(200),
          categoryId: z.string().max(200),
          note: z.string().max(1_000),
          confidence: z.enum(["high", "medium", "low"]),
          warnings: z.array(z.string().max(240)).max(10),
        }),
      )
      .max(100),
  });
  const result = schema.safeParse(value);
  if (!result.success) return null;

  const updatedAt = Date.parse(result.data.updatedAt);
  const maxAge = 30 * 24 * 60 * 60 * 1_000;
  if (!Number.isFinite(updatedAt) || updatedAt > now + 60_000 || now - updatedAt > maxAge) {
    return null;
  }
  return result.data satisfies AiQuickEntryDraft;
}

export function readAiQuickEntryDraft(storageKey: string) {
  const serialized = window.localStorage.getItem(storageKey);
  if (!serialized) return null;
  const draft = parseAiQuickEntryDraft(serialized);
  if (!draft) window.localStorage.removeItem(storageKey);
  return draft;
}

export function writeAiQuickEntryDraft(storageKey: string, draft: AiQuickEntryDraftInput) {
  const storedDraft: AiQuickEntryDraft = {
    ...draft,
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(storageKey, JSON.stringify(storedDraft));
  return storedDraft.updatedAt;
}

export function removeAiQuickEntryDraft(storageKey: string) {
  window.localStorage.removeItem(storageKey);
}
