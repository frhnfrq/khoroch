import type { BudgetLineDraft } from "@/lib/finance/budget-draft";

const BUDGET_DRAFT_SCHEMA_VERSION = 1 as const;
const BUDGET_DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const BUDGET_DRAFT_KEY_PREFIX = "khoroch:budget-draft:v1";

type BudgetDraftMetadata = {
  schemaVersion: typeof BUDGET_DRAFT_SCHEMA_VERSION;
  updatedAt: string;
};

export type CreateBudgetDraft = BudgetDraftMetadata & {
  kind: "create-budget";
  budgetMonth: string;
  name: string;
  lines: BudgetLineDraft[];
};

export type ManageBudgetDraft = BudgetDraftMetadata & {
  kind: "manage-budget";
  budgetId: string;
  baseVersion: number;
  name: string;
  rollover: boolean;
  lines: BudgetLineDraft[];
};

export type BudgetDraft = CreateBudgetDraft | ManageBudgetDraft;
export type CreateBudgetDraftInput = Omit<CreateBudgetDraft, keyof BudgetDraftMetadata>;
export type ManageBudgetDraftInput = Omit<ManageBudgetDraft, keyof BudgetDraftMetadata>;
export type BudgetDraftInput = CreateBudgetDraftInput | ManageBudgetDraftInput;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalNumber(value: unknown) {
  return value === undefined || (typeof value === "number" && Number.isInteger(value) && value > 0);
}

function isBudgetLineDraft(value: unknown): value is BudgetLineDraft {
  if (!isObject(value)) return false;

  return (
    typeof value.clientId === "string" &&
    value.clientId.length > 0 &&
    value.clientId.length <= 200 &&
    (value.id === undefined || (typeof value.id === "string" && value.id.length <= 200)) &&
    isOptionalNumber(value.version) &&
    typeof value.name === "string" &&
    value.name.length <= 100 &&
    typeof value.plannedAmount === "string" &&
    value.plannedAmount.length <= 100 &&
    typeof value.priorSpentAmount === "string" &&
    value.priorSpentAmount.length <= 100 &&
    typeof value.hasPriorSpending === "boolean" &&
    typeof value.categoryId === "string" &&
    value.categoryId.length <= 200 &&
    typeof value.parentClientId === "string" &&
    value.parentClientId.length <= 200
  );
}

function hasValidMetadata(value: Record<string, unknown>, now: number) {
  if (value.schemaVersion !== BUDGET_DRAFT_SCHEMA_VERSION || typeof value.updatedAt !== "string") {
    return false;
  }

  const updatedAt = Date.parse(value.updatedAt);
  return (
    Number.isFinite(updatedAt) &&
    updatedAt <= now + 60_000 &&
    now - updatedAt <= BUDGET_DRAFT_MAX_AGE_MS
  );
}

export function parseBudgetDraft(
  serialized: string,
  expectedKind: BudgetDraft["kind"],
  now = Date.now(),
): BudgetDraft | null {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    return null;
  }

  if (!isObject(value) || value.kind !== expectedKind || !hasValidMetadata(value, now)) {
    return null;
  }
  if (
    !Array.isArray(value.lines) ||
    value.lines.length > 100 ||
    !value.lines.every(isBudgetLineDraft)
  ) {
    return null;
  }
  if (typeof value.name !== "string" || value.name.length > 100) return null;

  if (value.kind === "create-budget") {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value.budgetMonth))
      ? (value as CreateBudgetDraft)
      : null;
  }

  return typeof value.budgetId === "string" &&
    value.budgetId.length > 0 &&
    value.budgetId.length <= 200 &&
    typeof value.baseVersion === "number" &&
    Number.isInteger(value.baseVersion) &&
    value.baseVersion > 0 &&
    typeof value.rollover === "boolean"
    ? (value as ManageBudgetDraft)
    : null;
}

export function budgetDraftStorageKey(
  userId: string,
  draft: { kind: "create-budget" } | { kind: "manage-budget"; budgetId: string },
) {
  const userScope = encodeURIComponent(userId);
  return draft.kind === "create-budget"
    ? `${BUDGET_DRAFT_KEY_PREFIX}:${userScope}:create`
    : `${BUDGET_DRAFT_KEY_PREFIX}:${userScope}:manage:${encodeURIComponent(draft.budgetId)}`;
}

export function readBudgetDraft(
  storageKey: string,
  expectedKind: BudgetDraft["kind"],
): BudgetDraft | null {
  const serialized = window.localStorage.getItem(storageKey);
  if (!serialized) return null;

  const draft = parseBudgetDraft(serialized, expectedKind);
  if (!draft) window.localStorage.removeItem(storageKey);
  return draft;
}

export function writeBudgetDraft(storageKey: string, draft: BudgetDraftInput) {
  const storedDraft: BudgetDraft = {
    ...draft,
    schemaVersion: BUDGET_DRAFT_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  } as BudgetDraft;
  window.localStorage.setItem(storageKey, JSON.stringify(storedDraft));
  return storedDraft.updatedAt;
}

export function removeBudgetDraft(storageKey: string) {
  window.localStorage.removeItem(storageKey);
}
