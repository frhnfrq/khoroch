import { createClientRequestId } from "@/lib/client-api";

export type BudgetLineDraft = {
  clientId: string;
  id?: string;
  version?: number;
  name: string;
  plannedAmount: string;
  priorSpentAmount: string;
  hasPriorSpending: boolean;
  categoryId: string;
  parentClientId: string;
};

export type BudgetLinePayload = {
  clientId: string;
  id?: string;
  version?: number;
  name: string;
  plannedAmount: number;
  priorSpentAmount: number;
  categoryId: string | null;
  parentClientId: string | null;
};

export function createBudgetLineDraft(): BudgetLineDraft {
  return {
    clientId: createClientRequestId(),
    name: "",
    plannedAmount: "",
    priorSpentAmount: "",
    hasPriorSpending: false,
    categoryId: "",
    parentClientId: "",
  };
}

export function hasBudgetLineDraftData(line: BudgetLineDraft) {
  return Boolean(
    line.name.trim() ||
    line.plannedAmount.trim() ||
    line.categoryId ||
    line.parentClientId ||
    line.hasPriorSpending ||
    line.priorSpentAmount.trim(),
  );
}

export function validateBudgetLineDrafts(
  lines: BudgetLineDraft[],
  options: { allowEmpty?: boolean; externalParentIds?: Iterable<string> } = {},
): { items: BudgetLinePayload[]; error: null } | { items: null; error: string } {
  const activeLines = lines.filter(hasBudgetLineDraftData);
  if (activeLines.length === 0) {
    if (options.allowEmpty) return { items: [], error: null };
    return { items: null, error: "Add at least one complete budget item." };
  }

  const clientIds = new Set(activeLines.map((line) => line.clientId));
  const validParentIds = new Set([...clientIds, ...(options.externalParentIds ?? [])]);
  if (clientIds.size !== activeLines.length) {
    return { items: null, error: "Budget items contain a duplicate identifier. Reopen and retry." };
  }

  for (const [index, line] of activeLines.entries()) {
    const itemNumber = index + 1;
    if (!line.name.trim()) {
      return { items: null, error: `Enter a name for budget item ${itemNumber}.` };
    }
    if (!line.plannedAmount.trim()) {
      return { items: null, error: `Enter a planned amount for “${line.name.trim()}”.` };
    }

    const plannedAmount = Number(line.plannedAmount);
    if (!Number.isFinite(plannedAmount) || plannedAmount < 0) {
      return { items: null, error: `Enter a valid planned amount for “${line.name.trim()}”.` };
    }

    if (line.hasPriorSpending && !line.priorSpentAmount.trim()) {
      return {
        items: null,
        error: `Enter the amount already spent for “${line.name.trim()}”.`,
      };
    }
    const priorSpentAmount = line.hasPriorSpending ? Number(line.priorSpentAmount) : 0;
    if (!Number.isFinite(priorSpentAmount) || priorSpentAmount < 0) {
      return {
        items: null,
        error: `Enter a valid prior-spending amount for “${line.name.trim()}”.`,
      };
    }

    if (line.parentClientId && !validParentIds.has(line.parentClientId)) {
      return { items: null, error: `Choose a valid parent for “${line.name.trim()}”.` };
    }
    if (line.parentClientId === line.clientId) {
      return { items: null, error: `“${line.name.trim()}” cannot be its own parent.` };
    }
  }

  const parentById = new Map(activeLines.map((line) => [line.clientId, line.parentClientId]));
  for (const line of activeLines) {
    const visited = new Set<string>();
    let currentId: string | undefined = line.clientId;
    while (currentId) {
      if (visited.has(currentId)) {
        return { items: null, error: "Budget item parents contain a cycle." };
      }
      visited.add(currentId);
      currentId = parentById.get(currentId) || undefined;
    }
  }

  return {
    items: activeLines.map((line) => ({
      clientId: line.clientId,
      ...(line.id ? { id: line.id, version: line.version } : {}),
      name: line.name.trim(),
      plannedAmount: Number(line.plannedAmount),
      priorSpentAmount: line.hasPriorSpending ? Number(line.priorSpentAmount) : 0,
      categoryId: line.categoryId || null,
      parentClientId: line.parentClientId || null,
    })),
    error: null,
  };
}

export function getDescendantClientIds(lines: BudgetLineDraft[], clientId: string) {
  const descendants = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const line of lines) {
      if (
        !descendants.has(line.clientId) &&
        (line.parentClientId === clientId || descendants.has(line.parentClientId))
      ) {
        descendants.add(line.clientId);
        changed = true;
      }
    }
  }
  return descendants;
}
