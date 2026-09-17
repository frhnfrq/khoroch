import assert from "node:assert/strict";
import test from "node:test";

import { getRemainingPlannedAmount } from "@/lib/finance/budget-remaining";

function item(
  id: string,
  plannedAmount: number,
  directLedgerSpentAmount: number,
  directPriorSpentAmount = 0,
  parentId: string | null = null,
) {
  return { id, parentId, plannedAmount, directLedgerSpentAmount, directPriorSpentAmount };
}

test("September remaining plans total 7,010 despite Bazar overspending by 4,003", () => {
  const items = [
    item("rent", 24680, 24680),
    item("bazar", 5000, 9003),
    item("salary", 1300, 0),
    item("transport", 2000, 830),
    item("claude", 2500, 0),
    item("akira", 2000, 2000),
    item("internet", 1398, 1398),
    item("office", 2000, 460),
    item("phone", 730, 730),
    item("meat", 500, 0),
    item("electricity", 1000, 1000),
    item("savings", 45000, 0, 45000),
  ];

  assert.equal(getRemainingPlannedAmount(items), 7010);
});

test("empty and fully spent budgets have no remaining planned spending", () => {
  assert.equal(getRemainingPlannedAmount([]), 0);
  assert.equal(getRemainingPlannedAmount([item("paid", 100, 100), item("over", 50, 75)]), 0);
});

test("prior spending counts toward the item's plan", () => {
  assert.equal(getRemainingPlannedAmount([item("partly-paid", 1000, 100, 600)]), 300);
});

test("nested plans are counted once and sibling overspending does not offset them", () => {
  assert.equal(
    getRemainingPlannedAmount([
      item("parent", 1000, 100),
      item("child", 600, 0, 0, "parent"),
      item("grandchild-over", 200, 350, 0, "child"),
      item("grandchild-unfinished", 400, 100, 0, "child"),
    ]),
    600,
  );
});

test("overspending directly on a parent does not consume its child's plan", () => {
  assert.equal(
    getRemainingPlannedAmount([item("parent", 500, 100), item("child", 500, 200, 0, "parent")]),
    300,
  );
});

test("returns currency precision for fractional amounts", () => {
  assert.equal(getRemainingPlannedAmount([item("a", 0.3, 0.1), item("b", 0.2, 0.1)]), 0.3);
});
