"use client";

import { useAuth } from "@clerk/nextjs";
import type { Category } from "@khoroch/db/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@khoroch/ui/components/alert-dialog";
import { Badge } from "@khoroch/ui/components/badge";
import { Button } from "@khoroch/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@khoroch/ui/components/card";
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
} from "@khoroch/ui/components/field";
import { Input } from "@khoroch/ui/components/input";
import { Spinner } from "@khoroch/ui/components/spinner";
import { Textarea } from "@khoroch/ui/components/textarea";
import { ToggleGroup, ToggleGroupItem } from "@khoroch/ui/components/toggle-group";
import {
  ArrowDownToLineIcon,
  ArrowLeftIcon,
  ArrowRightLeftIcon,
  CheckCheckIcon,
  CloudCheckIcon,
  CloudUploadIcon,
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
  SparklesIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";

import { CategoryPicker } from "@/components/category-picker";
import { MoneyInput } from "@/components/money-input";
import { SearchPicker } from "@/components/search-picker";
import { useAiQuickEntryDraft } from "@/hooks/use-ai-quick-entry-draft";
import { apiFetch, createClientRequestId } from "@/lib/client-api";
import {
  aiQuickEntryStorageKey,
  hasAiQuickEntryData,
  type AiQuickEntryDraft,
  type AiQuickEntryDraftInput,
  type AiQuickEntryItem,
  type AiTransactionType,
} from "@/lib/finance/ai-quick-entry";
import { formatMoney } from "@/lib/finance/format";
import type { AccountWithBalance } from "@/lib/finance/types";

const typeOptions: Array<{
  value: AiTransactionType;
  label: string;
  icon: typeof MinusIcon;
}> = [
  { value: "expense", label: "Expense", icon: MinusIcon },
  { value: "income", label: "Income", icon: ArrowDownToLineIcon },
  { value: "transfer", label: "Transfer", icon: ArrowRightLeftIcon },
];

function localDateValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function dateAtLocalNoon(value: string) {
  return new Date(`${value}T12:00:00`).toISOString();
}

function blankEntry(defaultAccountId: string): AiQuickEntryItem {
  return {
    clientId: createClientRequestId(),
    type: "expense",
    title: "",
    amount: "",
    occurredOn: localDateValue(),
    accountId: defaultAccountId,
    destinationAccountId: "",
    categoryId: "",
    note: "",
    confidence: "high",
    warnings: [],
  };
}

function confidenceVariant(confidence: AiQuickEntryItem["confidence"]) {
  return confidence === "low" ? "destructive" : confidence === "medium" ? "secondary" : "outline";
}

function validateEntry(
  item: AiQuickEntryItem,
  accounts: AccountWithBalance[],
  categories: Category[],
) {
  const errors: string[] = [];
  const amount = Number(item.amount);
  const source = accounts.find((account) => account.id === item.accountId);
  const destination = accounts.find((account) => account.id === item.destinationAccountId);

  if (!item.title.trim()) errors.push("Add a title.");
  if (!(amount > 0) || !Number.isFinite(amount)) errors.push("Enter an amount greater than zero.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.occurredOn)) errors.push("Choose a valid date.");
  if (!source) errors.push("Choose an active account.");
  if (item.categoryId && !categories.some((category) => category.id === item.categoryId)) {
    errors.push("Choose an active category or clear it.");
  }
  if (item.type === "transfer") {
    if (!destination) errors.push("Choose a destination account.");
    if (destination?.id === source?.id) errors.push("Source and destination must be different.");
    if (source && destination && source.currency !== destination.currency) {
      errors.push("Different-currency transfers need a manual exchange entry.");
    }
  }
  return errors;
}

export function AiQuickEntryDrawer() {
  const { userId } = useAuth();
  const { mutate } = useSWRConfig();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"compose" | "review">("compose");
  const [sourceText, setSourceText] = useState("");
  const [defaultAccountId, setDefaultAccountId] = useState("");
  const [entries, setEntries] = useState<AiQuickEntryItem[]>([]);
  const [parsing, setParsing] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [submitError, setSubmitError] = useState("");

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
  const accounts = accountData?.accounts.filter((account) => !account.isArchived) ?? [];
  const categories = categoryData?.categories.filter((category) => !category.isArchived) ?? [];

  useEffect(() => {
    if (open && !defaultAccountId && accounts[0]) setDefaultAccountId(accounts[0].id);
  }, [accounts, defaultAccountId, open]);

  const storageKey = userId ? aiQuickEntryStorageKey(userId) : null;
  const draft = useMemo<AiQuickEntryDraftInput>(
    () => ({
      kind: "ai-quick-entry",
      stage,
      sourceText,
      defaultAccountId,
      entries,
    }),
    [defaultAccountId, entries, sourceText, stage],
  );
  const isDirty = hasAiQuickEntryData(draft);
  const restoreDraft = useCallback((storedDraft: AiQuickEntryDraft) => {
    setStage(storedDraft.stage);
    setSourceText(storedDraft.sourceText);
    setDefaultAccountId(storedDraft.defaultAccountId);
    setEntries(storedDraft.entries);
    setSubmitError("");
  }, []);
  const {
    clearDraft,
    status: draftStatus,
    updatedAt,
  } = useAiQuickEntryDraft({
    storageKey,
    draft,
    isDirty,
    onRestore: restoreDraft,
  });

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
  const errorsByEntry = useMemo(
    () =>
      new Map(entries.map((entry) => [entry.clientId, validateEntry(entry, accounts, categories)])),
    [accounts, categories, entries],
  );
  const blockingErrorCount = [...errorsByEntry.values()].reduce(
    (total, errors) => total + errors.length,
    0,
  );
  const warningCount = entries.reduce((total, entry) => total + entry.warnings.length, 0);

  function updateEntry(clientId: string, changes: Partial<AiQuickEntryItem>) {
    setEntries((current) =>
      current.map((entry) => (entry.clientId === clientId ? { ...entry, ...changes } : entry)),
    );
    setSubmitError("");
  }

  function changeEntryType(entry: AiQuickEntryItem, type: AiTransactionType) {
    const selectedCategory = categories.find((category) => category.id === entry.categoryId);
    const expectedKind = type === "income" ? "income" : "expense";
    updateEntry(entry.clientId, {
      type,
      destinationAccountId: type === "transfer" ? entry.destinationAccountId : "",
      categoryId:
        type === "transfer" || (selectedCategory && selectedCategory.kind !== expectedKind)
          ? ""
          : entry.categoryId,
    });
  }

  function reset() {
    setStage("compose");
    setSourceText("");
    setDefaultAccountId(accounts[0]?.id ?? "");
    setEntries([]);
    setSubmitError("");
  }

  function discardDraft() {
    clearDraft();
    reset();
    toast.success("Quick-entry draft discarded.");
  }

  async function handleParse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (event.target !== event.currentTarget) return;
    if (!defaultAccountId) {
      const message = "Choose the account to use when a line does not name one.";
      setSubmitError(message);
      toast.error(message);
      return;
    }

    setParsing(true);
    setSubmitError("");
    try {
      const response = await apiFetch<{ entries: AiQuickEntryItem[] }>(
        "/api/ai/transactions/parse",
        {
          method: "POST",
          body: JSON.stringify({
            text: sourceText,
            defaultAccountId,
            today: localDateValue(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Dhaka",
          }),
        },
      );
      setEntries(response.entries);
      setStage("review");
      toast.success(
        `Found ${response.entries.length} ${response.entries.length === 1 ? "entry" : "entries"} to review.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not interpret these notes.";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setParsing(false);
    }
  }

  async function handleFinalize() {
    if (entries.length === 0) {
      const message = "Add at least one entry before saving.";
      setSubmitError(message);
      toast.error(message);
      return;
    }
    if (blockingErrorCount > 0) {
      const message = `Fix ${blockingErrorCount} highlighted ${blockingErrorCount === 1 ? "issue" : "issues"} before saving.`;
      setSubmitError(message);
      toast.error(message);
      return;
    }

    setFinalizing(true);
    setSubmitError("");
    try {
      const result = await apiFetch<{ createdCount: number; skippedCount: number }>(
        "/api/ai/transactions/finalize",
        {
          method: "POST",
          body: JSON.stringify({
            entries: entries.map((entry) => ({
              clientRequestId: entry.clientId,
              type: entry.type,
              title: entry.title,
              amount: Number(entry.amount),
              occurredAt: dateAtLocalNoon(entry.occurredOn),
              accountId: entry.accountId,
              destinationAccountId: entry.type === "transfer" ? entry.destinationAccountId : null,
              categoryId: entry.type === "transfer" ? null : entry.categoryId || null,
              note: entry.note || null,
            })),
          }),
        },
      );
      clearDraft();
      reset();
      setOpen(false);
      toast.success(
        result.createdCount > 0
          ? `${result.createdCount} ${result.createdCount === 1 ? "entry" : "entries"} saved.`
          : "These entries were already saved.",
      );
      try {
        await Promise.all([
          mutate("/api/accounts"),
          mutate((key) => typeof key === "string" && key.startsWith("/api/transactions")),
          mutate((key) => typeof key === "string" && key.startsWith("/api/budgets")),
        ]);
      } catch {
        toast.warning("Entries were saved, but the page could not refresh yet.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save these entries.";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setFinalizing(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} showSwipeHandle>
      <DrawerTrigger render={<Button />}>
        <SparklesIcon data-icon="inline-start" />
        {isDirty ? "Continue quick entry" : "Quick entry"}
      </DrawerTrigger>
      <DrawerContent className="mx-auto max-w-4xl">
        <DrawerHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <DrawerTitle>
                {stage === "compose" ? "Write it naturally" : "Review before saving"}
              </DrawerTitle>
              <DrawerDescription>
                {stage === "compose"
                  ? "Paste a whole note. Nothing reaches your ledger until you approve the review."
                  : "Correct anything the AI misunderstood, then save the batch together."}
              </DrawerDescription>
            </div>
            <Badge variant="secondary">
              {stage === "compose" ? "Draft" : `${entries.length} found`}
            </Badge>
          </div>
        </DrawerHeader>

        {stage === "compose" ? (
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleParse}>
            <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
              <FieldGroup>
                <Field data-invalid={Boolean(submitError && !defaultAccountId)}>
                  <FieldLabel>Default account</FieldLabel>
                  <SearchPicker
                    title="Choose a default account"
                    description="Lines that do not name an account will use this one."
                    placeholder="Choose account"
                    searchPlaceholder="Search accounts…"
                    emptyMessage="Add an account before using quick entry."
                    items={accountItems}
                    value={defaultAccountId}
                    onValueChange={setDefaultAccountId}
                    loading={accountsLoading}
                    errorMessage={accountError instanceof Error ? accountError.message : undefined}
                  />
                  <FieldDescription>
                    Named accounts such as “Redbox → Moneybag” override this choice.
                  </FieldDescription>
                </Field>

                <Field data-invalid={Boolean(submitError && !sourceText.trim())}>
                  <FieldLabel htmlFor="quick-entry-notes">
                    Expenses, income, and transfers
                  </FieldLabel>
                  <Textarea
                    id="quick-entry-notes"
                    value={sourceText}
                    onChange={(event) => {
                      setSourceText(event.target.value);
                      setSubmitError("");
                    }}
                    placeholder={
                      "Office rickshaw bus 30+10\nTicket print 5\n\n26th August\nAuto 20\nRedbox -> Moneybag 1700"
                    }
                    className="min-h-64 resize-y"
                    maxLength={20_000}
                    aria-invalid={Boolean(submitError && !sourceText.trim())}
                    required
                  />
                  <FieldDescription>
                    Dates can be headings. Arithmetic, shorthand, Bangla transliteration, and
                    account arrows are welcome.
                  </FieldDescription>
                </Field>

                {submitError ? <FieldError>{submitError}</FieldError> : null}
                {isDirty ? (
                  <DraftStatus
                    status={draftStatus}
                    updatedAt={updatedAt}
                    onDiscard={discardDraft}
                  />
                ) : null}
              </FieldGroup>
            </div>
            <DrawerFooter>
              <Button type="submit" disabled={parsing || accountsLoading || !sourceText.trim()}>
                {parsing ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <SparklesIcon data-icon="inline-start" />
                )}
                {parsing ? "Understanding your notes…" : "Review entries"}
              </Button>
            </DrawerFooter>
          </form>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="scroll-fade-b flex-1 overflow-y-auto px-4 pb-6 pt-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={blockingErrorCount > 0 ? "destructive" : "outline"}>
                    {blockingErrorCount > 0 ? `${blockingErrorCount} to fix` : "Ready when you are"}
                  </Badge>
                  {warningCount > 0 ? (
                    <Badge variant="secondary">{warningCount} AI warnings</Badge>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    No ledger records have been created yet.
                  </p>
                </div>

                {entries.map((entry, index) => (
                  <ReviewEntryCard
                    key={entry.clientId}
                    entry={entry}
                    index={index}
                    accounts={accounts}
                    categories={categories}
                    accountItems={accountItems}
                    accountsLoading={accountsLoading}
                    categoriesLoading={categoriesLoading}
                    accountError={accountError instanceof Error ? accountError.message : undefined}
                    categoryError={
                      categoryError instanceof Error ? categoryError.message : undefined
                    }
                    errors={errorsByEntry.get(entry.clientId) ?? []}
                    onChange={(changes) => updateEntry(entry.clientId, changes)}
                    onTypeChange={(type) => changeEntryType(entry, type)}
                    onRemove={() =>
                      setEntries((current) =>
                        current.filter((item) => item.clientId !== entry.clientId),
                      )
                    }
                  />
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setEntries((current) => [...current, blankEntry(defaultAccountId)])
                  }
                >
                  <PlusIcon data-icon="inline-start" />
                  Add another entry
                </Button>
                {submitError ? <FieldError>{submitError}</FieldError> : null}
                <DraftStatus status={draftStatus} updatedAt={updatedAt} onDiscard={discardDraft} />
              </div>
            </div>
            <DrawerFooter className="sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="sm:flex-1"
                onClick={() => setStage("compose")}
              >
                <ArrowLeftIcon data-icon="inline-start" />
                Edit original note
              </Button>
              <Button
                type="button"
                className="sm:flex-1"
                disabled={finalizing || entries.length === 0 || blockingErrorCount > 0}
                onClick={handleFinalize}
              >
                {finalizing ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <CheckCheckIcon data-icon="inline-start" />
                )}
                {finalizing
                  ? "Saving batch…"
                  : `Save ${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
              </Button>
            </DrawerFooter>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function ReviewEntryCard({
  entry,
  index,
  accounts,
  categories,
  accountItems,
  accountsLoading,
  categoriesLoading,
  accountError,
  categoryError,
  errors,
  onChange,
  onTypeChange,
  onRemove,
}: {
  entry: AiQuickEntryItem;
  index: number;
  accounts: AccountWithBalance[];
  categories: Category[];
  accountItems: Array<{
    value: string;
    label: string;
    description: string;
    icon: string;
    keywords: string;
  }>;
  accountsLoading: boolean;
  categoriesLoading: boolean;
  accountError?: string;
  categoryError?: string;
  errors: string[];
  onChange: (changes: Partial<AiQuickEntryItem>) => void;
  onTypeChange: (type: AiTransactionType) => void;
  onRemove: () => void;
}) {
  const selectedAccount = accounts.find((account) => account.id === entry.accountId);
  const currency = selectedAccount?.currency ?? "BDT";
  const destinationItems = accountItems.filter(
    (account) =>
      account.value !== entry.accountId &&
      (!selectedAccount ||
        accounts.find((candidate) => candidate.id === account.value)?.currency === currency),
  );

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <span>Entry {index + 1}</span>
          <Badge variant={confidenceVariant(entry.confidence)}>{entry.confidence} confidence</Badge>
          {errors.length > 0 ? <Badge variant="destructive">Needs review</Badge> : null}
        </CardTitle>
        <CardDescription>
          {entry.type === "transfer"
            ? "Money moving between two accounts"
            : `A ${entry.type} ledger entry`}
        </CardDescription>
        <CardAction>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            aria-label={`Remove entry ${index + 1}`}
          >
            <Trash2Icon />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>Type</FieldLabel>
            <ToggleGroup
              value={[entry.type]}
              onValueChange={(values) => {
                const type = values[0] as AiTransactionType | undefined;
                if (type) onTypeChange(type);
              }}
              variant="outline"
              className="grid w-full grid-cols-3"
            >
              {typeOptions.map(({ value, label, icon: Icon }) => (
                <ToggleGroupItem key={value} value={value} aria-label={label}>
                  <Icon data-icon="inline-start" />
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!entry.title.trim()}>
              <FieldLabel htmlFor={`quick-title-${entry.clientId}`}>Title</FieldLabel>
              <Input
                id={`quick-title-${entry.clientId}`}
                value={entry.title}
                onChange={(event) => onChange({ title: event.target.value })}
                maxLength={120}
                aria-invalid={!entry.title.trim()}
              />
            </Field>
            <Field data-invalid={!(Number(entry.amount) > 0)}>
              <FieldLabel htmlFor={`quick-amount-${entry.clientId}`}>Amount</FieldLabel>
              <MoneyInput
                id={`quick-amount-${entry.clientId}`}
                value={entry.amount}
                onChange={(event) => onChange({ amount: event.target.value })}
                currency={currency}
                min="0.01"
                step="0.01"
                aria-invalid={!(Number(entry.amount) > 0)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>{entry.type === "transfer" ? "From account" : "Account"}</FieldLabel>
              <SearchPicker
                title="Choose an account"
                description="Pick the account affected by this entry."
                placeholder="Choose account"
                searchPlaceholder="Search accounts…"
                items={accountItems}
                value={entry.accountId}
                onValueChange={(accountId) =>
                  onChange({
                    accountId,
                    destinationAccountId:
                      accountId === entry.destinationAccountId ? "" : entry.destinationAccountId,
                  })
                }
                loading={accountsLoading}
                errorMessage={accountError}
              />
            </Field>
            {entry.type === "transfer" ? (
              <Field>
                <FieldLabel>To account</FieldLabel>
                <SearchPicker
                  title="Choose a destination"
                  description="Only accounts using the same currency are shown."
                  placeholder="Choose destination"
                  searchPlaceholder="Search accounts…"
                  items={destinationItems}
                  value={entry.destinationAccountId}
                  onValueChange={(destinationAccountId) => onChange({ destinationAccountId })}
                  loading={accountsLoading}
                  errorMessage={accountError}
                />
              </Field>
            ) : (
              <Field>
                <FieldLabel>Category</FieldLabel>
                <CategoryPicker
                  categories={categories}
                  kind={entry.type === "income" ? "income" : "expense"}
                  value={entry.categoryId}
                  onValueChange={(categoryId) => onChange({ categoryId })}
                  loading={categoriesLoading}
                  errorMessage={categoryError}
                  optional
                />
              </Field>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`quick-date-${entry.clientId}`}>Date</FieldLabel>
              <Input
                id={`quick-date-${entry.clientId}`}
                type="date"
                value={entry.occurredOn}
                onChange={(event) => onChange({ occurredOn: event.target.value })}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`quick-note-${entry.clientId}`}>Note</FieldLabel>
              <Input
                id={`quick-note-${entry.clientId}`}
                value={entry.note}
                onChange={(event) => onChange({ note: event.target.value })}
                placeholder="Optional detail"
                maxLength={1_000}
              />
            </Field>
          </div>

          {errors.length > 0 ? (
            <FieldError errors={errors.map((message) => ({ message }))} />
          ) : null}
        </FieldGroup>
      </CardContent>
      {entry.warnings.length > 0 ? (
        <CardFooter className="items-start gap-2">
          <TriangleAlertIcon aria-hidden="true" />
          <div className="flex flex-1 flex-col gap-1">
            {entry.warnings.map((warning) => (
              <p key={warning} className="text-xs text-muted-foreground">
                {warning}
              </p>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange({ warnings: [], confidence: "high" })}
          >
            Mark reviewed
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}

function DraftStatus({
  status,
  updatedAt,
  onDiscard,
}: {
  status: "idle" | "restored" | "saving" | "saved" | "error";
  updatedAt: string | null;
  onDiscard: () => void;
}) {
  const details =
    status === "restored"
      ? { label: "Draft restored", icon: RotateCcwIcon, variant: "secondary" as const }
      : status === "saving"
        ? { label: "Saving draft…", icon: CloudUploadIcon, variant: "outline" as const }
        : status === "error"
          ? { label: "Draft not saved", icon: TriangleAlertIcon, variant: "destructive" as const }
          : status === "saved"
            ? { label: "Draft saved", icon: CloudCheckIcon, variant: "outline" as const }
            : {
                label: "Draft protection active",
                icon: CloudUploadIcon,
                variant: "outline" as const,
              };
  const StatusIcon = details.icon;
  const savedTime = updatedAt
    ? new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(
        new Date(updatedAt),
      )
    : null;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <Badge variant={details.variant} aria-live="polite">
            <StatusIcon data-icon="inline-start" />
            {details.label}
          </Badge>
        </CardTitle>
        <CardDescription>
          {status === "error"
            ? "Keep this drawer open until browser storage is available."
            : savedTime
              ? `Saved in this browser at ${savedTime}. Nothing is in your ledger yet.`
              : "Changes stay in this browser until you finalize them."}
        </CardDescription>
        <CardAction>
          <AlertDialog>
            <AlertDialogTrigger render={<Button type="button" variant="ghost" size="sm" />}>
              Discard
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Discard this quick-entry draft?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the pasted note and every unsaved reviewed entry from this browser.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep editing</AlertDialogCancel>
                <AlertDialogAction type="button" variant="destructive" onClick={onDiscard}>
                  Discard draft
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardAction>
      </CardHeader>
    </Card>
  );
}
