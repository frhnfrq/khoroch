type BudgetItemParent = {
  id: string;
  parentId: string | null;
};

export function getBudgetItemDescendantIds(items: BudgetItemParent[], itemId: string) {
  const descendants = new Set<string>();
  let changed = true;

  while (changed) {
    changed = false;
    for (const item of items) {
      if (
        !descendants.has(item.id) &&
        (item.parentId === itemId || (item.parentId && descendants.has(item.parentId)))
      ) {
        descendants.add(item.id);
        changed = true;
      }
    }
  }

  return descendants;
}

export function wouldCreateBudgetItemCycle(
  items: BudgetItemParent[],
  itemId: string,
  parentId: string | null,
) {
  if (!parentId) return false;
  if (parentId === itemId) return true;
  return getBudgetItemDescendantIds(items, itemId).has(parentId);
}
