import assert from "node:assert/strict";
import test from "node:test";

import {
  getBudgetItemDescendantIds,
  wouldCreateBudgetItemCycle,
} from "@/lib/finance/budget-item-parent";

const items = [
  { id: "food", parentId: null },
  { id: "groceries", parentId: "food" },
  { id: "vegetables", parentId: "groceries" },
  { id: "rent", parentId: null },
];

test("finds all descendants across multiple levels", () => {
  assert.deepEqual([...getBudgetItemDescendantIds(items, "food")].sort(), [
    "groceries",
    "vegetables",
  ]);
});

test("rejects self-parenting and descendant-parenting", () => {
  assert.equal(wouldCreateBudgetItemCycle(items, "food", "food"), true);
  assert.equal(wouldCreateBudgetItemCycle(items, "food", "vegetables"), true);
  assert.equal(wouldCreateBudgetItemCycle(items, "groceries", "vegetables"), true);
});

test("allows top-level and unrelated parents", () => {
  assert.equal(wouldCreateBudgetItemCycle(items, "groceries", null), false);
  assert.equal(wouldCreateBudgetItemCycle(items, "groceries", "rent"), false);
});
