"use client";

import type { Category } from "@khoroch/db/schema";
import { Badge } from "@khoroch/ui/components/badge";
import { Button } from "@khoroch/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@khoroch/ui/components/empty";
import { Field, FieldGroup, FieldLabel } from "@khoroch/ui/components/field";
import { Input } from "@khoroch/ui/components/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@khoroch/ui/components/input-group";
import { Separator } from "@khoroch/ui/components/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@khoroch/ui/components/sheet";
import { Skeleton } from "@khoroch/ui/components/skeleton";
import { ListFilterIcon, SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import useSWR from "swr";

import { MoneyInput } from "@/components/money-input";
import { SearchPicker, type SearchPickerItem } from "@/components/search-picker";
import { TransactionDetailsDrawer } from "@/components/transaction-details-drawer";
import { TransactionRow } from "@/components/transaction-row";
import { useFinanceSettings } from "@/hooks/use-finance-settings";
import { getCategoryPath } from "@/lib/finance/category-tree";
import type { AccountWithBalance, TransactionView } from "@/lib/finance/types";

const transactionTypes = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
  { value: "refund", label: "Refund" },
  { value: "adjustment", label: "Adjustment" },
] as const;

const statusItems = [
  { value: "cleared", label: "Cleared" },
  { value: "pending", label: "Pending" },
  { value: "void", label: "Void" },
] as const;

const dayFormatter = new Intl.DateTimeFormat("en-BD", {
  weekday: "short",
  month: "long",
  day: "numeric",
  year: "numeric",
});

type Filters = {
  from: string;
  to: string;
  minAmount: string;
  maxAmount: string;
  categoryId: string;
  accountId: string;
  type: string;
  status: string;
};

const emptyFilters: Filters = {
  from: "",
  to: "",
  minAmount: "",
  maxAmount: "",
  categoryId: "",
  accountId: "",
  type: "",
  status: "",
};

export default function TransactionsPage() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { defaultCurrency } = useFinanceSettings();

  const {
    data: accountData,
    error: accountError,
    isLoading: accountsLoading,
  } = useSWR<{ accounts: AccountWithBalance[] }>("/api/accounts");
  const {
    data: categoryData,
    error: categoryError,
    isLoading: categoriesLoading,
  } = useSWR<{ categories: Category[] }>("/api/categories");
  const accounts = accountData?.accounts.filter((account) => !account.isArchived) ?? [];
  const categories = categoryData?.categories.filter((category) => !category.isArchived) ?? [];
  const accountItems = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: account.name,
        description: account.type,
        icon: account.icon,
      })),
    [accounts],
  );
  const categoryItems = useMemo(
    () =>
      categories.map((category) => ({
        value: category.id,
        label: getCategoryPath(category, categories),
        description: category.kind === "income" ? "Income" : "Expense",
        icon: category.icon,
      })),
    [categories],
  );

  const endpoint = useMemo(() => {
    const params = new URLSearchParams({ limit: "250" });
    if (deferredQuery.trim()) params.set("query", deferredQuery.trim());
    if (filters.from) params.set("from", new Date(`${filters.from}T00:00:00`).toISOString());
    if (filters.to) params.set("to", new Date(`${filters.to}T23:59:59.999`).toISOString());
    if (filters.minAmount) params.set("minAmount", filters.minAmount);
    if (filters.maxAmount) params.set("maxAmount", filters.maxAmount);
    if (filters.categoryId) params.set("categoryId", filters.categoryId);
    if (filters.accountId) params.set("accountId", filters.accountId);
    if (filters.type) params.set("type", filters.type);
    if (filters.status) params.set("status", filters.status);
    return `/api/transactions?${params.toString()}`;
  }, [deferredQuery, filters]);

  const { data, error, isLoading } = useSWR<{ transactions: TransactionView[] }>(endpoint);
  const transactions = data?.transactions ?? [];
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, TransactionView[]>();
    for (const transaction of transactions) {
      const key = new Date(transaction.occurredAt).toDateString();
      const group = groups.get(key) ?? [];
      group.push(transaction);
      groups.set(key, group);
    }
    return [...groups.entries()];
  }, [transactions]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground">
          Every account movement in one searchable ledger.
        </p>
      </div>

      <div className="flex gap-2">
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, payee, or notes"
            aria-label="Search activity"
          />
          {query ? (
            <InputGroupAddon align="inline-end">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                <XIcon />
              </Button>
            </InputGroupAddon>
          ) : null}
        </InputGroup>

        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger render={<Button variant="outline" />}>
            <SlidersHorizontalIcon data-icon="inline-start" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 ? <Badge variant="secondary">{activeFilterCount}</Badge> : null}
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Filter activity</SheetTitle>
              <SheetDescription>
                Combine any date, amount, account, category, or status filters.
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              <FieldGroup>
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="filter-from">From</FieldLabel>
                    <Input
                      id="filter-from"
                      type="date"
                      value={filters.from}
                      onChange={(event) =>
                        setFilters((current) => ({ ...current, from: event.target.value }))
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="filter-to">To</FieldLabel>
                    <Input
                      id="filter-to"
                      type="date"
                      value={filters.to}
                      onChange={(event) =>
                        setFilters((current) => ({ ...current, to: event.target.value }))
                      }
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="filter-min">Minimum</FieldLabel>
                    <MoneyInput
                      id="filter-min"
                      currency={defaultCurrency}
                      min="0"
                      step="0.01"
                      value={filters.minAmount}
                      onChange={(event) =>
                        setFilters((current) => ({ ...current, minAmount: event.target.value }))
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="filter-max">Maximum</FieldLabel>
                    <MoneyInput
                      id="filter-max"
                      currency={defaultCurrency}
                      min="0"
                      step="0.01"
                      value={filters.maxAmount}
                      onChange={(event) =>
                        setFilters((current) => ({ ...current, maxAmount: event.target.value }))
                      }
                    />
                  </Field>
                </div>
                <FilterSelect
                  label="Account"
                  placeholder="Any account"
                  items={accountItems}
                  value={filters.accountId}
                  onChange={(value) => setFilters((current) => ({ ...current, accountId: value }))}
                  loading={accountsLoading}
                  errorMessage={accountError instanceof Error ? accountError.message : undefined}
                />
                <FilterSelect
                  label="Category"
                  placeholder="Any category"
                  items={categoryItems}
                  value={filters.categoryId}
                  onChange={(value) => setFilters((current) => ({ ...current, categoryId: value }))}
                  loading={categoriesLoading}
                  errorMessage={categoryError instanceof Error ? categoryError.message : undefined}
                />
                <FilterSelect
                  label="Activity type"
                  placeholder="Any type"
                  items={[...transactionTypes]}
                  value={filters.type}
                  onChange={(value) => setFilters((current) => ({ ...current, type: value }))}
                />
                <FilterSelect
                  label="Status"
                  placeholder="Any status"
                  items={[...statusItems]}
                  value={filters.status}
                  onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
                />
              </FieldGroup>
            </div>
            <SheetFooter>
              <Button variant="outline" onClick={() => setFilters(emptyFilters)}>
                Clear all
              </Button>
              <Button onClick={() => setFiltersOpen(false)}>Show results</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : error ? (
        <Empty className="min-h-80">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListFilterIcon />
            </EmptyMedia>
            <EmptyTitle>Could not load activity</EmptyTitle>
            <EmptyDescription>Refresh the page or check the database connection.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : transactions.length === 0 ? (
        <Empty className="min-h-80">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListFilterIcon />
            </EmptyMedia>
            <EmptyTitle>No matching activity</EmptyTitle>
            <EmptyDescription>
              Change the filters or use the plus button to add an entry.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-6">
          {groupedTransactions.map(([date, group]) => (
            <section key={date}>
              <h2 className="mb-1 text-xs font-medium text-muted-foreground">
                {dayFormatter.format(new Date(date))}
              </h2>
              <div>
                {group.map((transaction, index) => (
                  <div key={transaction.id}>
                    <TransactionDetailsDrawer
                      transaction={transaction}
                      trigger={<TransactionRow transaction={transaction} />}
                    />
                    {index < group.length - 1 ? <Separator /> : null}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  placeholder,
  items,
  value,
  onChange,
  loading = false,
  errorMessage,
}: {
  label: string;
  placeholder: string;
  items: SearchPickerItem[];
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
  errorMessage?: string;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <SearchPicker
        title={`Choose ${label.toLowerCase()}`}
        placeholder={placeholder}
        items={items}
        value={value}
        onValueChange={onChange}
        loading={loading}
        errorMessage={errorMessage}
        clearable
      />
    </Field>
  );
}
