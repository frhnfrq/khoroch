"use client";

import type { Category } from "@khoroch/db/schema";
import { Badge } from "@khoroch/ui/components/badge";
import { Button } from "@khoroch/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@khoroch/ui/components/drawer";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@khoroch/ui/components/field";
import { Input } from "@khoroch/ui/components/input";
import { Spinner } from "@khoroch/ui/components/spinner";
import { Switch } from "@khoroch/ui/components/switch";
import { Textarea } from "@khoroch/ui/components/textarea";
import { ToggleGroup, ToggleGroupItem } from "@khoroch/ui/components/toggle-group";
import {
  ArrowDownToLineIcon,
  ArrowRightLeftIcon,
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
  ScaleIcon,
  SplitIcon,
} from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";

import { CategoryPicker } from "@/components/category-picker";
import { MoneyInput } from "@/components/money-input";
import { SearchPicker } from "@/components/search-picker";
import { SubItemPanel } from "@/components/sub-item-panel";
import { useFinanceSettings } from "@/hooks/use-finance-settings";
import { apiFetch, createClientRequestId } from "@/lib/client-api";
import { formatMoney } from "@/lib/finance/format";
import type { AccountWithBalance, BudgetView, FundingBucketView } from "@/lib/finance/types";

type QuickTransactionType = "expense" | "income" | "transfer" | "refund" | "adjustment";

type SplitLine = {
  id: string;
  amount: string;
  categoryId: string;
  budgetItemId: string;
  memo: string;
};

const transactionTypeItems: Array<{
  value: QuickTransactionType;
  label: string;
  icon: typeof MinusIcon;
}> = [
  { value: "expense", label: "Expense", icon: MinusIcon },
  { value: "income", label: "Income", icon: ArrowDownToLineIcon },
  { value: "transfer", label: "Transfer", icon: ArrowRightLeftIcon },
  { value: "refund", label: "Refund", icon: RotateCcwIcon },
  { value: "adjustment", label: "Adjust", icon: ScaleIcon },
];

function newSplitLine(): SplitLine {
  return {
    id: createClientRequestId(),
    amount: "",
    categoryId: "",
    budgetItemId: "",
    memo: "",
  };
}

export function AddTransactionDrawer({
  trigger,
  defaultType = "expense",
}: {
  trigger?: ReactNode;
  defaultType?: QuickTransactionType;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<QuickTransactionType>(defaultType);
  const [title, setTitle] = useState("");
  const [payee, setPayee] = useState("");
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [accountId, setAccountId] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferFee, setTransferFee] = useState("");
  const [feeDeducted, setFeeDeducted] = useState(false);
  const [adjustedBalance, setAdjustedBalance] = useState("");
  const [fundingBucketId, setFundingBucketId] = useState("");
  const [isSalary, setIsSalary] = useState(false);
  const [lines, setLines] = useState<SplitLine[]>(() => [newSplitLine()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const { mutate } = useSWRConfig();
  const { defaultCurrency } = useFinanceSettings();
  const {
    data: accountData,
    error: accountError,
    isLoading: accountsLoading,
  } = useSWR<{ accounts: AccountWithBalance[] }>(open ? "/api/accounts" : null);
  const {
    data: categoryData,
    error: categoryError,
    isLoading: categoriesLoading,
  } = useSWR<{ categories: Category[] }>(open ? "/api/categories" : null);
  const activityMonth = occurredAt.slice(0, 7) || new Date().toISOString().slice(0, 7);
  const {
    data: budgetData,
    error: budgetError,
    isLoading: budgetsLoading,
  } = useSWR<{ budgets: BudgetView[] }>(open ? `/api/budgets?month=${activityMonth}` : null);
  const {
    data: fundingData,
    error: fundingError,
    isLoading: fundingLoading,
  } = useSWR<{ fundingBuckets: FundingBucketView[] }>(open ? "/api/funding-buckets" : null);

  const accounts = accountData?.accounts.filter((account) => !account.isArchived) ?? [];
  const categories = categoryData?.categories.filter((category) => !category.isArchived) ?? [];
  const currentBudget = budgetData?.budgets[0] ?? null;
  const fundingBuckets = fundingData?.fundingBuckets.filter((bucket) => !bucket.isArchived) ?? [];

  const accountItems = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: account.name,
        description: `${formatMoney(account.balance, account.currency)} available`,
        icon: account.icon,
        keywords: account.type,
      })),
    [accounts],
  );
  const destinationItems = useMemo(
    () => accountItems.filter((account) => account.value !== accountId),
    [accountId, accountItems],
  );
  const budgetItems = currentBudget?.items ?? [];
  const budgetSelectItems = useMemo(
    () =>
      budgetItems.map((item) => {
        const parent = budgetItems.find((candidate) => candidate.id === item.parentId);
        return {
          value: item.id,
          label: parent ? `${parent.name} / ${item.name}` : item.name,
          description: `${formatMoney(item.remainingAmount, defaultCurrency)} remaining`,
          icon: item.category?.icon ?? undefined,
        };
      }),
    [budgetItems, defaultCurrency],
  );
  const fundingSelectItems = useMemo(
    () =>
      fundingBuckets.map((bucket) => ({
        value: bucket.id,
        label: bucket.name,
        description: `${formatMoney(bucket.remainingAmount, defaultCurrency)} remaining`,
        keywords: bucket.type,
      })),
    [defaultCurrency, fundingBuckets],
  );
  const selectedAccount = accounts.find((account) => account.id === accountId) ?? null;
  const activeCurrency = selectedAccount?.currency ?? defaultCurrency;

  function updateLine(id: string, changes: Partial<SplitLine>) {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...changes } : line)));
  }

  function resetForm() {
    setType(defaultType);
    setTitle("");
    setPayee("");
    setNote("");
    setAccountId("");
    setDestinationAccountId("");
    setTransferAmount("");
    setTransferFee("");
    setFeeDeducted(false);
    setAdjustedBalance("");
    setFundingBucketId("");
    setIsSalary(false);
    setLines([newSplitLine()]);
    setSubmitError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");
    if (!accountId) {
      const message = "Choose an account first.";
      setSubmitError(message);
      toast.error(message);
      return;
    }

    setIsSubmitting(true);
    try {
      const occurredAtIso = new Date(occurredAt).toISOString();
      const clientRequestId = createClientRequestId();

      if (type === "transfer") {
        const amount = Number(transferAmount);
        const fee = Number(transferFee || 0);
        if (!destinationAccountId || destinationAccountId === accountId) {
          throw new Error("Choose a different destination account.");
        }
        if (!(amount > 0) || fee < 0 || (feeDeducted && fee >= amount)) {
          throw new Error("Enter a valid transfer amount and fee.");
        }

        const principal = feeDeducted ? amount - fee : amount;
        const feeCategory = categories.find(
          (category) => category.kind === "expense" && category.name === "Fees",
        );
        await apiFetch("/api/transactions", {
          method: "POST",
          body: JSON.stringify({
            clientRequestId,
            type,
            status: "cleared",
            occurredAt: occurredAtIso,
            title: title || "Account transfer",
            payee: null,
            note: note || null,
            parentTransactionId: null,
            createFundingBucket: null,
            entries: [
              {
                accountId,
                amount: -principal,
                categoryId: null,
                budgetItemId: null,
                fundingBucketId: fundingBucketId || null,
                memo: "Transfer out",
              },
              {
                accountId: destinationAccountId,
                amount: principal,
                categoryId: null,
                budgetItemId: null,
                fundingBucketId: fundingBucketId || null,
                memo: "Transfer in",
              },
              ...(fee > 0
                ? [
                    {
                      accountId,
                      amount: -fee,
                      categoryId: feeCategory?.id ?? null,
                      budgetItemId: null,
                      fundingBucketId: fundingBucketId || null,
                      memo: "Transfer fee",
                    },
                  ]
                : []),
            ],
          }),
        });
      } else if (type === "adjustment") {
        if (!selectedAccount) throw new Error("Choose the account you reconciled.");
        const targetBalance = Number(adjustedBalance);
        if (!Number.isFinite(targetBalance)) throw new Error("Enter the verified account balance.");
        const difference = Math.round((targetBalance - selectedAccount.balance) * 100) / 100;
        if (difference === 0) throw new Error("This account already has that balance.");

        await apiFetch("/api/transactions", {
          method: "POST",
          body: JSON.stringify({
            clientRequestId,
            type,
            status: "cleared",
            occurredAt: occurredAtIso,
            title: title || "Balance adjustment",
            payee: null,
            note: note || null,
            parentTransactionId: null,
            createFundingBucket: null,
            entries: [
              {
                accountId,
                amount: difference,
                categoryId: null,
                budgetItemId: null,
                fundingBucketId: null,
                memo: `Reconciled from ${formatMoney(selectedAccount.balance)} to ${formatMoney(targetBalance)}`,
              },
            ],
          }),
        });
      } else {
        const validLines = lines.filter((line) => Number(line.amount) > 0);
        if (validLines.length === 0) throw new Error("Enter at least one amount.");

        const salaryEntry = type === "income" && isSalary;
        const salaryCategory = categories.find(
          (category) => category.kind === "income" && category.name === "Salary",
        );
        const selectedIncomeCategory = categories.find(
          (category) => category.id === validLines[0]?.categoryId,
        );
        const fundingTypeByCategory = {
          salary: "salary",
          freelance: "freelance",
          bonus: "bonus",
          gift: "gift",
          loan: "loan",
        } as const;
        const effectiveTitle =
          title ||
          (salaryEntry
            ? "Salary"
            : type === "income"
              ? "Income"
              : type === "refund"
                ? "Refund"
                : "Expense");
        await apiFetch("/api/transactions", {
          method: "POST",
          body: JSON.stringify({
            clientRequestId,
            type,
            status: "cleared",
            occurredAt: occurredAtIso,
            title: effectiveTitle,
            payee: payee || null,
            note: note || null,
            parentTransactionId: null,
            createFundingBucket:
              type === "income"
                ? {
                    name: salaryEntry
                      ? `${new Intl.DateTimeFormat("en", {
                          month: "long",
                          year: "numeric",
                        }).format(new Date(occurredAt))} salary`
                      : effectiveTitle,
                    type: salaryEntry
                      ? "salary"
                      : (fundingTypeByCategory[
                          selectedIncomeCategory?.name.toLowerCase() as keyof typeof fundingTypeByCategory
                        ] ?? "other"),
                    periodStart: occurredAt.slice(0, 7) + "-01",
                    periodEnd: null,
                  }
                : null,
            entries: validLines.map((line) => ({
              accountId,
              amount: Number(line.amount) * (type === "expense" ? -1 : 1),
              categoryId: salaryEntry ? (salaryCategory?.id ?? null) : line.categoryId || null,
              budgetItemId:
                type === "expense" || type === "refund" ? line.budgetItemId || null : null,
              fundingBucketId: fundingBucketId || null,
              memo: line.memo || null,
            })),
          }),
        });
      }

      await Promise.all([
        mutate("/api/accounts"),
        mutate((key) => typeof key === "string" && key.startsWith("/api/transactions")),
        mutate((key) => typeof key === "string" && key.startsWith("/api/budgets")),
        mutate("/api/funding-buckets"),
      ]);
      toast.success(
        type === "transfer"
          ? "Transfer recorded."
          : type === "adjustment"
            ? "Balance reconciled."
            : "Activity recorded.",
      );
      resetForm();
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save this activity.";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} showSwipeHandle>
      <DrawerTrigger
        render={
          trigger ? (
            <span />
          ) : (
            <Button size="icon-lg" aria-label="Add activity">
              <PlusIcon />
            </Button>
          )
        }
      >
        {trigger}
      </DrawerTrigger>
      <DrawerContent className="mx-auto max-w-2xl">
        <DrawerHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <DrawerTitle>Record activity</DrawerTitle>
              <DrawerDescription>One focused flow updates every linked balance.</DrawerDescription>
            </div>
            <Badge variant="secondary">{activeCurrency}</Badge>
          </div>
        </DrawerHeader>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <FieldGroup>
              <Field>
                <FieldLabel>What happened?</FieldLabel>
                <ToggleGroup
                  value={[type]}
                  onValueChange={(values) => {
                    const nextType = values[0] as QuickTransactionType | undefined;
                    if (nextType) {
                      setType(nextType);
                      setSubmitError("");
                      if (nextType !== "income") setIsSalary(false);
                    }
                  }}
                  variant="outline"
                  className="grid w-full grid-cols-2 sm:grid-cols-5"
                >
                  {transactionTypeItems.map(({ value, label, icon: Icon }) => (
                    <ToggleGroupItem key={value} value={value} aria-label={label}>
                      <Icon data-icon="inline-start" />
                      {label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>

              <Field>
                <FieldLabel htmlFor="activity-title">Title</FieldLabel>
                <Input
                  id="activity-title"
                  name="title"
                  autoComplete="off"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={type === "transfer" ? "Transfer to savings" : "What was this for?"}
                  maxLength={120}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={Boolean(submitError && !accountId)}>
                  <FieldLabel>{type === "transfer" ? "From account" : "Account"}</FieldLabel>
                  <SearchPicker
                    title="Choose an account"
                    description="Search by account name or type. Current balances are shown below."
                    placeholder="Choose account"
                    searchPlaceholder="Search accounts…"
                    emptyMessage="No accounts are available yet."
                    items={accountItems}
                    value={accountId}
                    onValueChange={(value) => {
                      setAccountId(value);
                      if (value === destinationAccountId) setDestinationAccountId("");
                    }}
                    loading={accountsLoading}
                    errorMessage={accountError instanceof Error ? accountError.message : undefined}
                  />
                  {accounts.length === 0 && !accountsLoading ? (
                    <FieldDescription>Add an account before recording activity.</FieldDescription>
                  ) : null}
                </Field>
                <Field>
                  <FieldLabel htmlFor="activity-date">Date and time</FieldLabel>
                  <Input
                    id="activity-date"
                    name="occurredAt"
                    type="datetime-local"
                    value={occurredAt}
                    onChange={(event) => setOccurredAt(event.target.value)}
                    required
                  />
                </Field>
              </div>

              {type === "transfer" ? (
                <div className="flex flex-col gap-4 rounded-2xl border bg-muted/30 p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>To account</FieldLabel>
                      <SearchPicker
                        title="Choose destination"
                        description="The source account is hidden to prevent a transfer to itself."
                        placeholder="Choose destination"
                        searchPlaceholder="Search accounts…"
                        emptyMessage="Add another account before making a transfer."
                        items={destinationItems}
                        value={destinationAccountId}
                        onValueChange={setDestinationAccountId}
                        loading={accountsLoading}
                        errorMessage={
                          accountError instanceof Error ? accountError.message : undefined
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="transfer-amount">Transfer amount</FieldLabel>
                      <MoneyInput
                        id="transfer-amount"
                        name="transferAmount"
                        currency={activeCurrency}
                        min="0.01"
                        step="0.01"
                        value={transferAmount}
                        onChange={(event) => setTransferAmount(event.target.value)}
                        required
                      />
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="transfer-fee">Transfer fee</FieldLabel>
                      <MoneyInput
                        id="transfer-fee"
                        name="transferFee"
                        currency={activeCurrency}
                        min="0"
                        step="0.01"
                        value={transferFee}
                        onChange={(event) => setTransferFee(event.target.value)}
                      />
                    </Field>
                    <Field orientation="horizontal" className="rounded-xl border bg-background p-3">
                      <div className="flex flex-col gap-0.5">
                        <FieldTitle>Deduct fee from amount</FieldTitle>
                        <FieldDescription>
                          Recipient gets the amount minus the fee.
                        </FieldDescription>
                      </div>
                      <Switch
                        aria-label="Deduct transfer fee from amount"
                        checked={feeDeducted}
                        onCheckedChange={setFeeDeducted}
                      />
                    </Field>
                  </div>
                </div>
              ) : type === "adjustment" ? (
                <Field>
                  <FieldLabel htmlFor="adjusted-balance">Verified balance</FieldLabel>
                  <MoneyInput
                    id="adjusted-balance"
                    name="adjustedBalance"
                    currency={activeCurrency}
                    step="0.01"
                    value={adjustedBalance}
                    onChange={(event) => setAdjustedBalance(event.target.value)}
                    placeholder={selectedAccount ? String(selectedAccount.balance) : "0.00"}
                    required
                  />
                  <FieldDescription>
                    {selectedAccount
                      ? `Ledger balance: ${formatMoney(selectedAccount.balance, selectedAccount.currency)}. Only the difference is recorded.`
                      : "Choose an account, then enter the balance you verified."}
                  </FieldDescription>
                </Field>
              ) : (
                <>
                  {type === "income" ? (
                    <Field orientation="horizontal" className="rounded-2xl border bg-muted/30 p-4">
                      <div className="flex flex-col gap-0.5">
                        <FieldTitle>Salary income</FieldTitle>
                        <FieldDescription>
                          Create a salary bucket that later expenses can use.
                        </FieldDescription>
                      </div>
                      <Switch
                        aria-label="Mark as salary income"
                        checked={isSalary}
                        onCheckedChange={setIsSalary}
                      />
                    </Field>
                  ) : null}

                  <div className="flex flex-col gap-4">
                    {lines.map((line, index) => (
                      <SubItemPanel
                        key={line.id}
                        index={index}
                        label={lines.length > 1 ? "Split" : "Amount and category"}
                        nested={lines.length > 1}
                        onRemove={
                          lines.length > 1
                            ? () =>
                                setLines((current) => current.filter((item) => item.id !== line.id))
                            : undefined
                        }
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field>
                            <FieldLabel htmlFor={`line-amount-${line.id}`}>Amount</FieldLabel>
                            <MoneyInput
                              id={`line-amount-${line.id}`}
                              name={`lineAmount-${index}`}
                              currency={activeCurrency}
                              min="0.01"
                              step="0.01"
                              value={line.amount}
                              onChange={(event) =>
                                updateLine(line.id, { amount: event.target.value })
                              }
                              required={index === 0}
                            />
                          </Field>
                          <Field>
                            <FieldLabel>Category</FieldLabel>
                            <CategoryPicker
                              categories={categories}
                              kind={type === "income" ? "income" : "expense"}
                              value={type === "income" && isSalary ? "" : line.categoryId}
                              onValueChange={(value) => updateLine(line.id, { categoryId: value })}
                              loading={categoriesLoading}
                              errorMessage={
                                categoryError instanceof Error ? categoryError.message : undefined
                              }
                              optional
                              disabled={type === "income" && isSalary}
                            />
                            {type === "income" && isSalary ? (
                              <FieldDescription>
                                Salary category is applied automatically.
                              </FieldDescription>
                            ) : null}
                          </Field>
                        </div>
                        {(type === "expense" || type === "refund") &&
                        (currentBudget || budgetsLoading || budgetError) ? (
                          <Field>
                            <FieldLabel>Budget item</FieldLabel>
                            <SearchPicker
                              title="Choose a budget item"
                              description={`Showing the budget for ${activityMonth}. Parent paths and remaining amounts are included.`}
                              placeholder="Optional budget link"
                              searchPlaceholder="Search budget items…"
                              emptyMessage="No budget items match this search."
                              items={budgetSelectItems}
                              value={line.budgetItemId}
                              onValueChange={(value) => {
                                const budgetItem = budgetItems.find((item) => item.id === value);
                                updateLine(line.id, {
                                  budgetItemId: value,
                                  categoryId: budgetItem?.category?.id ?? line.categoryId,
                                });
                              }}
                              loading={budgetsLoading}
                              errorMessage={
                                budgetError instanceof Error ? budgetError.message : undefined
                              }
                              clearable
                            />
                          </Field>
                        ) : null}
                        {lines.length > 1 ? (
                          <Field>
                            <FieldLabel htmlFor={`line-memo-${line.id}`}>Split note</FieldLabel>
                            <Input
                              id={`line-memo-${line.id}`}
                              name={`lineMemo-${index}`}
                              autoComplete="off"
                              value={line.memo}
                              onChange={(event) =>
                                updateLine(line.id, { memo: event.target.value })
                              }
                              placeholder="Optional"
                            />
                          </Field>
                        ) : null}
                      </SubItemPanel>
                    ))}
                    {type === "expense" ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setLines((current) => [...current, newSplitLine()])}
                      >
                        <SplitIcon data-icon="inline-start" />
                        Split across categories
                      </Button>
                    ) : null}
                  </div>
                </>
              )}

              {type !== "income" && type !== "adjustment" ? (
                <Field>
                  <FieldLabel>Funded by</FieldLabel>
                  <SearchPicker
                    title="Choose funding source"
                    description="Link this activity to the salary or credit that funded it."
                    placeholder="Optional income bucket"
                    searchPlaceholder="Search income buckets…"
                    emptyMessage="Record an income first to create a funding bucket."
                    items={fundingSelectItems}
                    value={fundingBucketId}
                    onValueChange={setFundingBucketId}
                    loading={fundingLoading}
                    errorMessage={fundingError instanceof Error ? fundingError.message : undefined}
                    clearable
                  />
                </Field>
              ) : null}

              <details className="group rounded-2xl border bg-muted/20 p-4">
                <summary className="cursor-pointer list-none text-sm font-medium marker:hidden">
                  More details
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    Payee and notes
                  </span>
                </summary>
                <div className="mt-4 flex flex-col gap-4">
                  {type !== "transfer" && type !== "adjustment" ? (
                    <Field>
                      <FieldLabel htmlFor="activity-payee">Payee or source</FieldLabel>
                      <Input
                        id="activity-payee"
                        name="payee"
                        autoComplete="off"
                        value={payee}
                        onChange={(event) => setPayee(event.target.value)}
                        placeholder={type === "income" ? "Employer or client" : "Shop or person"}
                      />
                    </Field>
                  ) : null}
                  <Field>
                    <FieldLabel htmlFor="activity-note">Note</FieldLabel>
                    <Textarea
                      id="activity-note"
                      name="note"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Optional details"
                      rows={3}
                    />
                  </Field>
                </div>
              </details>

              {submitError ? <FieldError>{submitError}</FieldError> : null}
            </FieldGroup>
          </div>

          <DrawerFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <PlusIcon data-icon="inline-start" />
              )}
              {isSubmitting ? "Saving…" : "Save activity"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
