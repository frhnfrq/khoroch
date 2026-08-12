"use client";

import { Badge } from "@khoroch/ui/components/badge";
import { Button } from "@khoroch/ui/components/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@khoroch/ui/components/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@khoroch/ui/components/drawer";
import { Progress } from "@khoroch/ui/components/progress";
import { Separator } from "@khoroch/ui/components/separator";
import { EyeIcon } from "lucide-react";

import { BudgetItemDrawer } from "@/components/budget-item-drawer";
import { formatMoney } from "@/lib/finance/format";
import type { BudgetItemView, BudgetView } from "@/lib/finance/types";

const dateFormatter = new Intl.DateTimeFormat("en-BD", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function AmountCard({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[65%] text-right font-medium">{value}</dd>
    </div>
  );
}

export function BudgetItemDetailsDrawer({
  budget,
  item,
}: {
  budget: BudgetView;
  item: BudgetItemView;
}) {
  const parent = item.parentId
    ? budget.items.find((candidate) => candidate.id === item.parentId)
    : null;
  const children = budget.items.filter((candidate) => candidate.parentId === item.id);
  const progress =
    item.plannedAmount > 0
      ? Math.min(100, Math.max(0, (item.spentAmount / item.plannedAmount) * 100))
      : 0;
  const status =
    item.remainingAmount < 0
      ? { label: "Over budget", variant: "destructive" as const }
      : item.plannedAmount > 0 && item.spentAmount >= item.plannedAmount
        ? { label: "Completed", variant: "secondary" as const }
        : { label: "In progress", variant: "outline" as const };
  const directSpentAmount = item.directLedgerSpentAmount + item.directPriorSpentAmount;

  return (
    <Drawer showSwipeHandle>
      <DrawerTrigger
        render={
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`View ${item.name}`} />
        }
      >
        <EyeIcon />
      </DrawerTrigger>
      <DrawerContent className="mx-auto max-w-xl">
        <DrawerHeader>
          <div className="flex items-center gap-2">
            <DrawerTitle>{item.name}</DrawerTitle>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <DrawerDescription>
            {children.length > 0
              ? "Totals include sub-items. The item amounts below exclude them."
              : "Exact amounts, progress, category, and tracking details."}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <AmountCard label="Planned" value={formatMoney(item.plannedAmount, budget.currency)} />
            <AmountCard label="Spent" value={formatMoney(item.spentAmount, budget.currency)} />
            <AmountCard
              label="Remaining"
              value={formatMoney(item.remainingAmount, budget.currency)}
            />
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium tabular-nums">{progress.toFixed(1)}%</span>
            </div>
            <Progress value={progress} />
          </div>

          <Separator className="my-5" />

          <dl className="text-xs">
            <DetailRow label="Budget" value={budget.name} />
            <DetailRow
              label="Period"
              value={`${dateFormatter.format(new Date(`${budget.periodStart}T00:00:00`))} – ${dateFormatter.format(new Date(`${budget.periodEnd}T00:00:00`))}`}
            />
            <DetailRow label="Category" value={item.category?.name ?? "Uncategorized"} />
            <DetailRow label="Parent item" value={parent?.name ?? "Top level"} />
            <DetailRow
              label="Planned for this item"
              value={formatMoney(item.directPlannedAmount, budget.currency)}
            />
            <DetailRow
              label="Spending from activity"
              value={formatMoney(item.directLedgerSpentAmount, budget.currency)}
            />
            <DetailRow
              label="Spent before tracking"
              value={formatMoney(item.directPriorSpentAmount, budget.currency)}
            />
            <DetailRow
              label="Remaining for this item"
              value={formatMoney(item.directPlannedAmount - directSpentAmount, budget.currency)}
            />
            {children.length > 0 ? (
              <DetailRow label="Sub-items" value={children.map((child) => child.name).join(", ")} />
            ) : null}
            <DetailRow
              label="Last updated"
              value={dateFormatter.format(new Date(item.updatedAt))}
            />
          </dl>
        </div>

        <DrawerFooter>
          <BudgetItemDrawer budget={budget} item={item} />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
