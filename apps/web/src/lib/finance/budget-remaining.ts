import type { BudgetItemView } from "@/lib/finance/types";

type RemainingBudgetItem = Pick<
  BudgetItemView,
  "id" | "parentId" | "plannedAmount" | "directLedgerSpentAmount" | "directPriorSpentAmount"
>;

// Takes rolled-up items, whose planned amounts already include their children.
export function getRemainingPlannedAmount(items: RemainingBudgetItem[]) {
  const childPlannedByParent = new Map<string, number>();
  for (const item of items) {
    if (!item.parentId) continue;
    childPlannedByParent.set(
      item.parentId,
      (childPlannedByParent.get(item.parentId) ?? 0) + item.plannedAmount,
    );
  }

  const remaining = items.reduce((sum, item) => {
    // Count child allocations separately so overspending cannot consume another
    // item's unfinished plan, and parent/child plans are not counted twice.
    const ownPlanned = item.plannedAmount - (childPlannedByParent.get(item.id) ?? 0);
    const ownSpent = item.directLedgerSpentAmount + item.directPriorSpentAmount;
    return sum + Math.max(0, ownPlanned - ownSpent);
  }, 0);

  return Math.round(remaining * 100) / 100;
}
