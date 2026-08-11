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
import { Separator } from "@khoroch/ui/components/separator";
import { Skeleton } from "@khoroch/ui/components/skeleton";
import { cn } from "@khoroch/ui/lib/utils";
import { LandmarkIcon } from "lucide-react";
import useSWR from "swr";

import { CreateAccountDrawer } from "@/components/create-account-drawer";
import { FinanceIcon } from "@/components/finance-icon";
import { useFinanceSettings } from "@/hooks/use-finance-settings";
import { formatMoney } from "@/lib/finance/format";
import type { AccountWithBalance } from "@/lib/finance/types";

const accountTones = [
  "bg-chart-1/15 text-chart-1",
  "bg-chart-2/15 text-chart-2",
  "bg-chart-3/15 text-chart-3",
  "bg-chart-4/15 text-chart-4",
  "bg-chart-5/15 text-chart-5",
] as const;

const accountTypeLabels: Record<AccountWithBalance["type"], string> = {
  cash: "Cash",
  bank: "Bank account",
  mobile_wallet: "Mobile wallet",
  savings: "Savings",
  credit_card: "Credit card",
  other: "Other",
};

export default function AccountsPage() {
  const { defaultCurrency } = useFinanceSettings();
  const { data, error, isLoading, mutate } = useSWR<{ accounts: AccountWithBalance[] }>(
    "/api/accounts",
  );
  const accounts = data?.accounts.filter((account) => !account.isArchived) ?? [];
  const total = accounts.reduce((sum, account) => sum + account.balance, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Your current balances, rebuilt from the ledger.
          </p>
        </div>
        <CreateAccountDrawer />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28 w-full rounded-3xl" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : error ? (
        <Empty className="min-h-80">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LandmarkIcon />
            </EmptyMedia>
            <EmptyTitle>Could not load accounts</EmptyTitle>
            <EmptyDescription>Refresh the page or check your database connection.</EmptyDescription>
          </EmptyHeader>
          <Button type="button" onClick={() => void mutate()}>
            Try again
          </Button>
        </Empty>
      ) : accounts.length === 0 ? (
        <Empty className="min-h-80 border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LandmarkIcon />
            </EmptyMedia>
            <EmptyTitle>Start with where your money is</EmptyTitle>
            <EmptyDescription>
              Add bKash, bank accounts, and cash with their current balances.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <CreateAccountDrawer />
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <section className="rounded-3xl bg-primary p-5 text-primary-foreground sm:p-6">
            <p className="text-xs text-primary-foreground/70">
              Total across {accounts.length} accounts
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">
              {formatMoney(total, defaultCurrency)}
            </p>
          </section>

          <section>
            {accounts.map((account, index) => (
              <div key={account.id}>
                <div className="flex items-center gap-3 py-4">
                  <span
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-2xl",
                      accountTones[index % accountTones.length],
                    )}
                  >
                    <FinanceIcon name={account.icon} className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{account.name}</p>
                      <Badge variant="secondary">{accountTypeLabels[account.type]}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Opening balance {formatMoney(account.openingBalance, account.currency)}
                    </p>
                  </div>
                  <p className="shrink-0 text-base font-semibold tabular-nums">
                    {formatMoney(account.balance, account.currency)}
                  </p>
                </div>
                {index < accounts.length - 1 ? <Separator /> : null}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
