"use client";

import { Badge } from "@khoroch/ui/components/badge";
import { Button } from "@khoroch/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@khoroch/ui/components/empty";
import { Input } from "@khoroch/ui/components/input";
import { Progress } from "@khoroch/ui/components/progress";
import { Separator } from "@khoroch/ui/components/separator";
import { Skeleton } from "@khoroch/ui/components/skeleton";
import { cn } from "@khoroch/ui/lib/utils";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CornerDownRightIcon,
  PiggyBankIcon,
} from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

import { CreateBudgetDrawer } from "@/components/create-budget-drawer";
import { FinanceIcon } from "@/components/finance-icon";
import { formatCompactMoney, formatMoney } from "@/lib/finance/format";
import type { BudgetView } from "@/lib/finance/types";

function defaultMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(year, monthNumber - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

export default function BudgetsPage() {
  const [month, setMonth] = useState(defaultMonth);
  const { data, error, isLoading, mutate } = useSWR<{ budgets: BudgetView[] }>(
    `/api/budgets?month=${month}`,
  );
  const budget = data?.budgets[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Budgets</h1>
          <p className="text-sm text-muted-foreground">
            Plan once, then link every expense as it happens.
          </p>
        </div>
        <CreateBudgetDrawer month={month} />
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Previous month"
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          <ChevronLeftIcon />
        </Button>
        <Input
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          aria-label="Budget month"
          className="w-40 text-center"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Next month"
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          <ChevronRightIcon />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-36 w-full rounded-3xl" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : error ? (
        <Empty className="min-h-80">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PiggyBankIcon />
            </EmptyMedia>
            <EmptyTitle>Could not load this budget</EmptyTitle>
            <EmptyDescription>Refresh the page or check the database connection.</EmptyDescription>
          </EmptyHeader>
          <Button type="button" onClick={() => void mutate()}>
            Try again
          </Button>
        </Empty>
      ) : !budget ? (
        <Empty className="min-h-80 border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PiggyBankIcon />
            </EmptyMedia>
            <EmptyTitle>No budget for this month</EmptyTitle>
            <EmptyDescription>
              Create budget items such as rent, groceries, office, and travel.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <CreateBudgetDrawer month={month} />
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <section className="flex flex-col gap-5 rounded-3xl bg-primary p-5 text-primary-foreground sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-primary-foreground/70">Remaining in {budget.name}</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight">
                  {formatMoney(budget.remainingAmount, budget.currency)}
                </p>
              </div>
              {budget.rollover ? <Badge variant="secondary">Rollover</Badge> : null}
            </div>
            <Progress
              value={
                budget.plannedAmount > 0
                  ? Math.min(100, (budget.spentAmount / budget.plannedAmount) * 100)
                  : 0
              }
              tone="inverse"
            />
            <div className="flex justify-between gap-4 text-xs text-primary-foreground/75">
              <span>{formatCompactMoney(budget.spentAmount, budget.currency)} spent</span>
              <span>{formatCompactMoney(budget.plannedAmount, budget.currency)} planned</span>
            </div>
          </section>

          <section>
            {budget.items.map((item, index) => {
              const ratio =
                item.plannedAmount > 0
                  ? Math.min(100, (item.spentAmount / item.plannedAmount) * 100)
                  : 0;
              return (
                <div key={item.id}>
                  <div className={cn("flex items-center gap-3 py-4", item.parentId && "pl-6")}>
                    {item.parentId ? (
                      <CornerDownRightIcon className="size-4 shrink-0 text-muted-foreground" />
                    ) : null}
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-chart-4/15 text-chart-4">
                      <FinanceIcon name={item.category?.icon ?? "piggy-bank"} className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium">{item.name}</p>
                        <p
                          className={cn(
                            "shrink-0 text-xs tabular-nums",
                            item.remainingAmount < 0 ? "text-destructive" : "text-muted-foreground",
                          )}
                        >
                          {formatCompactMoney(item.spentAmount, budget.currency)} /{" "}
                          {formatCompactMoney(item.plannedAmount, budget.currency)}
                        </p>
                      </div>
                      <Progress value={ratio} className="mt-2" />
                    </div>
                  </div>
                  {index < budget.items.length - 1 ? <Separator /> : null}
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
