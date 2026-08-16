"use client";

import { Badge } from "@khoroch/ui/components/badge";
import { Button } from "@khoroch/ui/components/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@khoroch/ui/components/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@khoroch/ui/components/empty";
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
import { Skeleton } from "@khoroch/ui/components/skeleton";
import { CircleAlertIcon, ReceiptTextIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import useSWR from "swr";

import { BudgetItemDrawer } from "@/components/budget-item-drawer";
import { TransactionDetailsDrawer } from "@/components/transaction-details-drawer";
import { formatMoney } from "@/lib/finance/format";
import type { BudgetItemView, BudgetView, TransactionView } from "@/lib/finance/types";

const dateFormatter = new Intl.DateTimeFormat("en-BD", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const activityDateFormatter = new Intl.DateTimeFormat("en-BD", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type LinkedActivity = {
  transaction: TransactionView;
  impact: number;
  accountNames: string[];
  itemNames: string[];
};

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

function LinkedActivityRow({ activity, currency }: { activity: LinkedActivity; currency: string }) {
  const restoresBudget = activity.impact < 0;
  const details = [
    activityDateFormatter.format(new Date(activity.transaction.occurredAt)),
    activity.accountNames.join(" + "),
    activity.itemNames.join(" + "),
  ].filter(Boolean);

  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <ReceiptTextIcon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{activity.transaction.title}</p>
          {activity.transaction.status === "pending" ? (
            <Badge variant="secondary">Pending</Badge>
          ) : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">{details.join(" · ")}</p>
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums">
        {restoresBudget ? "+" : "−"}
        {formatMoney(Math.abs(activity.impact), currency)}
      </p>
    </div>
  );
}

export function BudgetItemDetailsDrawer({
  budget,
  item,
  trigger,
}: {
  budget: BudgetView;
  item: BudgetItemView;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const {
    data: transactionData,
    error: transactionError,
    isLoading: transactionsLoading,
    mutate: mutateTransactions,
  } = useSWR<{ transactions: TransactionView[] }>(
    open ? `/api/transactions?budgetId=${budget.id}&limit=250` : null,
  );
  const parent = item.parentId
    ? budget.items.find((candidate) => candidate.id === item.parentId)
    : null;
  const children = budget.items.filter((candidate) => candidate.parentId === item.id);
  const relatedItemIds = useMemo(() => {
    const ids = new Set([item.id]);
    let foundChild = true;
    while (foundChild) {
      foundChild = false;
      for (const candidate of budget.items) {
        if (candidate.parentId && ids.has(candidate.parentId) && !ids.has(candidate.id)) {
          ids.add(candidate.id);
          foundChild = true;
        }
      }
    }
    return ids;
  }, [budget.items, item.id]);
  const linkedActivities = useMemo<LinkedActivity[]>(
    () =>
      (transactionData?.transactions ?? []).flatMap((transaction) => {
        if (transaction.status === "void") return [];
        const matchingEntries = transaction.entries.filter(
          (entry) => entry.budgetItemId && relatedItemIds.has(entry.budgetItemId),
        );
        if (matchingEntries.length === 0) return [];
        const impact = matchingEntries.reduce((sum, entry) => sum - Number(entry.amount), 0);
        if (Math.abs(impact) < 0.005) return [];
        return [
          {
            transaction,
            impact,
            accountNames: [...new Set(matchingEntries.map((entry) => entry.accountName))],
            itemNames: [
              ...new Set(
                matchingEntries.flatMap((entry) =>
                  entry.budgetItemName ? [entry.budgetItemName] : [],
                ),
              ),
            ],
          },
        ];
      }),
    [relatedItemIds, transactionData?.transactions],
  );
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
    <Drawer open={open} onOpenChange={setOpen} showSwipeHandle>
      <DrawerTrigger
        render={
          <button
            type="button"
            className="group flex w-full items-center gap-3 rounded-2xl px-2 py-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={`View ${item.name} budget details`}
          />
        }
      >
        {trigger}
      </DrawerTrigger>
      <DrawerContent className="mx-auto max-w-xl">
        <DrawerHeader>
          <div className="flex items-center gap-2">
            <DrawerTitle>{item.name}</DrawerTitle>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <DrawerDescription>
            {children.length > 0
              ? "Totals and linked activity include this item and its sub-items."
              : "Amounts, linked activity, category, and tracking details."}
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

          <section className="flex flex-col gap-3">
            <div>
              <h3 className="text-xs font-medium">Linked activity</h3>
              <p className="text-xs text-muted-foreground">
                {children.length > 0
                  ? "Recorded spending for this item and its sub-items."
                  : "Recorded spending linked to this budget item."}
              </p>
            </div>

            {transactionsLoading && !transactionData ? (
              <div className="flex flex-col gap-2" aria-label="Loading linked activity">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : transactionError && !transactionData ? (
              <Empty className="min-h-48 border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CircleAlertIcon />
                  </EmptyMedia>
                  <EmptyTitle>Could not load linked activity</EmptyTitle>
                  <EmptyDescription>Try loading this budget item again.</EmptyDescription>
                </EmptyHeader>
                <Button type="button" size="sm" onClick={() => void mutateTransactions()}>
                  Try again
                </Button>
              </Empty>
            ) : linkedActivities.length === 0 ? (
              <Empty className="min-h-48 border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ReceiptTextIcon />
                  </EmptyMedia>
                  <EmptyTitle>No linked activity yet</EmptyTitle>
                  <EmptyDescription>
                    Choose this budget item when recording an expense or refund.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="overflow-hidden rounded-2xl border">
                {linkedActivities.map((activity, index) => (
                  <div key={activity.transaction.id}>
                    <TransactionDetailsDrawer
                      transaction={activity.transaction}
                      trigger={<LinkedActivityRow activity={activity} currency={budget.currency} />}
                    />
                    {index < linkedActivities.length - 1 ? <Separator /> : null}
                  </div>
                ))}
              </div>
            )}
          </section>

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
