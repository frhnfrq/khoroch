"use client";

import { Badge } from "@khoroch/ui/components/badge";
import { Button } from "@khoroch/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@khoroch/ui/components/empty";
import { Progress } from "@khoroch/ui/components/progress";
import { Separator } from "@khoroch/ui/components/separator";
import { Skeleton } from "@khoroch/ui/components/skeleton";
import { cn } from "@khoroch/ui/lib/utils";
import {
  ArrowDownLeftIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  BriefcaseBusinessIcon,
  CircleAlertIcon,
  LandmarkIcon,
  PiggyBankIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";

import { BalanceVisibility } from "@/components/balance-visibility";
import { FinanceIcon } from "@/components/finance-icon";
import { TransactionRow } from "@/components/transaction-row";
import { useFinanceSettings } from "@/hooks/use-finance-settings";
import { formatCompactMoney, formatMoney } from "@/lib/finance/format";
import type {
  AccountWithBalance,
  BudgetView,
  FundingBucketView,
  TransactionTotalView,
  TransactionView,
} from "@/lib/finance/types";

const accountTones = [
  "bg-chart-1/15 text-chart-1",
  "bg-chart-2/15 text-chart-2",
  "bg-chart-3/15 text-chart-3",
  "bg-chart-4/15 text-chart-4",
  "bg-chart-5/15 text-chart-5",
] as const;

const fundingTypeLabels: Record<FundingBucketView["type"], string> = {
  salary: "Salary",
  freelance: "Freelance",
  bonus: "Bonus",
  gift: "Gift",
  loan: "Loan",
  other: "Income",
};

function OverviewAccountCard({
  account,
  tone,
}: {
  account: AccountWithBalance;
  tone: (typeof accountTones)[number];
}) {
  const [isBalanceVisible, setIsBalanceVisible] = useState(false);
  const formattedBalance = formatMoney(account.balance, account.currency);
  const actionLabel = isBalanceVisible ? "Hide balance" : "Show balance";

  return (
    <button
      type="button"
      aria-label={
        isBalanceVisible
          ? `${account.name} balance: ${formattedBalance}. Click to hide.`
          : `${account.name} balance is hidden. Click to show.`
      }
      aria-pressed={isBalanceVisible}
      title={`${actionLabel} for ${account.name}`}
      className="flex min-w-44 items-center gap-3 rounded-2xl border bg-background p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onClick={() => setIsBalanceVisible((visible) => !visible)}
    >
      <span
        aria-hidden="true"
        className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", tone)}
      >
        <FinanceIcon name={account.icon} className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs text-muted-foreground">{account.name}</span>
        <span className="block overflow-hidden rounded-sm">
          <span
            aria-hidden={!isBalanceVisible}
            className={cn(
              "block truncate text-sm font-semibold tabular-nums transition-[filter] duration-200 motion-reduce:transition-none",
              !isBalanceVisible && "select-none blur-md",
            )}
          >
            {formattedBalance}
          </span>
        </span>
      </span>
    </button>
  );
}

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return {
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

export default function DashboardPage() {
  const range = currentMonthRange();
  const { defaultCurrency } = useFinanceSettings();
  const {
    data: accountData,
    error: accountError,
    isLoading: accountsLoading,
    mutate: mutateAccounts,
  } = useSWR<{
    accounts: AccountWithBalance[];
  }>("/api/accounts");
  const {
    data: transactionData,
    error: transactionError,
    isLoading: transactionsLoading,
    mutate: mutateTransactions,
  } = useSWR<{ transactions: TransactionView[]; totals: TransactionTotalView[] }>(
    `/api/transactions?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}&limit=8&includeSummary=true`,
  );
  const {
    data: budgetData,
    error: budgetError,
    isLoading: budgetsLoading,
    mutate: mutateBudgets,
  } = useSWR<{ budgets: BudgetView[] }>(`/api/budgets?month=${range.month}`);
  const {
    data: fundingData,
    error: fundingError,
    isLoading: fundingLoading,
    mutate: mutateFunding,
  } = useSWR<{ fundingBuckets: FundingBucketView[] }>("/api/funding-buckets");

  const accounts = accountData?.accounts.filter((account) => !account.isArchived) ?? [];
  const transactions = transactionData?.transactions ?? [];
  const transactionTotals = transactionData?.totals ?? [];
  const currentBudget = budgetData?.budgets[0] ?? null;
  const fundingBuckets = [...(fundingData?.fundingBuckets ?? [])]
    .filter((bucket) => !bucket.isArchived)
    .reverse()
    .slice(0, 5);
  const accountTotals = [...new Set(accounts.map((account) => account.currency))].map(
    (currency) => ({
      currency,
      amount: accounts
        .filter((account) => account.currency === currency)
        .reduce((sum, account) => sum + account.balance, 0),
    }),
  );
  const formatTransactionTotals = (type: TransactionView["type"]) => {
    const matching = transactionTotals.filter((total) => total.type === type);
    const currencies = [...new Set(matching.map((total) => total.currency))];
    if (currencies.length === 0) return formatCompactMoney(0, defaultCurrency);
    return currencies
      .map((currency) =>
        formatCompactMoney(
          matching
            .filter((total) => total.currency === currency)
            .reduce((sum, total) => sum + total.amount, 0),
          currency,
        ),
      )
      .join(" · ");
  };

  if (accountsLoading || transactionsLoading || budgetsLoading || fundingLoading) {
    return <DashboardSkeleton />;
  }

  if (accountError || transactionError || budgetError || fundingError) {
    return (
      <Empty className="min-h-[60svh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CircleAlertIcon />
          </EmptyMedia>
          <EmptyTitle>Could not load your ledger</EmptyTitle>
          <EmptyDescription>
            Your data is safe. Check the connection, then try loading it again.
          </EmptyDescription>
        </EmptyHeader>
        <Button
          type="button"
          onClick={() => {
            void Promise.all([
              mutateAccounts(),
              mutateTransactions(),
              mutateBudgets(),
              mutateFunding(),
            ]);
          }}
        >
          Try again
        </Button>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <section className="relative overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-14 size-40 rounded-full bg-background/10" />
        <div className="relative flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-primary-foreground/70">Across all accounts</p>
              <BalanceVisibility>
                <p className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  {accountTotals.length > 0
                    ? accountTotals
                        .map((total) => formatMoney(total.amount, total.currency))
                        .join(" · ")
                    : formatMoney(0, defaultCurrency)}
                </p>
              </BalanceVisibility>
            </div>
            <Badge variant="secondary">Live balance</Badge>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:max-w-md">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-xl bg-background/10">
                <ArrowDownLeftIcon className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[0.65rem] text-primary-foreground/70">Income this month</p>
                <p className="text-sm font-semibold">{formatTransactionTotals("income")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-xl bg-background/10">
                <ArrowUpRightIcon className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[0.65rem] text-primary-foreground/70">Spent this month</p>
                <p className="text-sm font-semibold">{formatTransactionTotals("expense")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {accounts.length === 0 ? (
        <section className="flex items-center justify-between gap-4 rounded-2xl border border-dashed p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-chart-1/15 text-chart-1">
              <LandmarkIcon className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium">Add your first account</p>
              <p className="text-xs text-muted-foreground">Start with bKash, bank, or cash.</p>
            </div>
          </div>
          <Button size="sm" nativeButton={false} render={<Link href="/accounts" />}>
            Add
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Accounts</h2>
              <p className="text-xs text-muted-foreground">
                Balances after every recorded movement
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/accounts" />}
            >
              See all
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
          <div className="scroll-fade-x flex gap-3 overflow-x-auto pb-1">
            {accounts.map((account, index) => (
              <OverviewAccountCard
                key={account.id}
                account={account}
                tone={accountTones[index % accountTones.length] ?? accountTones[0]}
              />
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-7 lg:grid-cols-[1.35fr_0.65fr]">
        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Recent activity</h2>
              <p className="text-xs text-muted-foreground">
                Income, expenses, and transfers together
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/transactions" />}
            >
              Filters
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
          {transactionsLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-6 text-center">
              <p className="text-sm font-medium">No activity yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Use the plus button to record your first entry.
              </p>
            </div>
          ) : (
            <div>
              {transactions.map((transaction, index) => (
                <div key={transaction.id}>
                  <TransactionRow transaction={transaction} compact />
                  {index < transactions.length - 1 ? <Separator /> : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Monthly budget</h2>
              <p className="text-xs text-muted-foreground">Planned versus spent</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/budgets" />}
            >
              Open
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
          {!currentBudget ? (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed p-4">
              <span className="flex size-9 items-center justify-center rounded-xl bg-chart-4/15 text-chart-4">
                <PiggyBankIcon className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">No budget this month</p>
                <p className="text-xs text-muted-foreground">
                  Create one from a reusable monthly plan.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 rounded-2xl border p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Remaining</p>
                  <p className="text-xl font-semibold">
                    {formatMoney(currentBudget.remainingAmount, currentBudget.currency)}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatCompactMoney(currentBudget.spentAmount, currentBudget.currency)} of{" "}
                  {formatCompactMoney(currentBudget.plannedAmount, currentBudget.currency)}
                </p>
              </div>
              <Progress
                value={
                  currentBudget.plannedAmount > 0
                    ? Math.min(100, (currentBudget.spentAmount / currentBudget.plannedAmount) * 100)
                    : 0
                }
              />
              <div className="flex flex-col gap-2">
                {currentBudget.items
                  .filter((item) => !item.parentId && item.remainingAmount > 0)
                  .slice(0, 4)
                  .map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate">{item.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatCompactMoney(item.spentAmount, currentBudget.currency)} /{" "}
                        {formatCompactMoney(item.plannedAmount, currentBudget.currency)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold">Income sources</h2>
          <p className="text-xs text-muted-foreground">
            See how much of each salary or credit has funded later expenses.
          </p>
        </div>
        {fundingBuckets.length === 0 ? (
          <div className="relative flex items-center gap-4 py-2 pl-7">
            <span
              aria-hidden="true"
              className="absolute inset-y-1 left-1 border-l-2 border-dashed border-border"
            />
            <span className="flex size-9 items-center justify-center rounded-xl bg-chart-2/15 text-chart-2">
              <BriefcaseBusinessIcon className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium">No trackable income yet</p>
              <p className="text-xs text-muted-foreground">
                Record income, then choose it from “Funded by” on an expense.
              </p>
            </div>
          </div>
        ) : (
          <div>
            {fundingBuckets.map((bucket, index) => {
              const usedPercent =
                bucket.fundedAmount > 0
                  ? Math.min(100, (bucket.spentAmount / bucket.fundedAmount) * 100)
                  : 0;
              return (
                <div key={bucket.id}>
                  <div className="flex items-center gap-3 py-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-chart-2/15 text-chart-2">
                      <BriefcaseBusinessIcon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-sm font-medium">{bucket.name}</p>
                          <Badge variant="secondary">{fundingTypeLabels[bucket.type]}</Badge>
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums">
                          {formatMoney(bucket.remainingAmount, bucket.currency)}
                        </p>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3">
                        <Progress value={usedPercent} className="h-1.5 flex-1" />
                        <p className="shrink-0 text-[0.65rem] tabular-nums text-muted-foreground">
                          {formatCompactMoney(bucket.spentAmount, bucket.currency)} of{` `}
                          {formatCompactMoney(bucket.fundedAmount, bucket.currency)} used
                        </p>
                      </div>
                    </div>
                  </div>
                  {index < fundingBuckets.length - 1 ? <Separator /> : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-48 w-full rounded-3xl" />
      <div className="flex gap-3">
        <Skeleton className="h-16 w-44 rounded-2xl" />
        <Skeleton className="h-16 w-44 rounded-2xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
