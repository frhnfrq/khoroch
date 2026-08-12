"use client";

import { useAuth } from "@clerk/nextjs";
import type { Category } from "@khoroch/db/schema";
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
import { Field, FieldGroup, FieldLabel } from "@khoroch/ui/components/field";
import { Input } from "@khoroch/ui/components/input";
import { Spinner } from "@khoroch/ui/components/spinner";
import { PiggyBankIcon, PlusIcon } from "lucide-react";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";

import { BudgetLineEditor } from "@/components/budget-line-editor";
import { BudgetDraftStatus } from "@/components/budget-draft-status";
import { useBudgetDraft } from "@/hooks/use-budget-draft";
import { useFinanceSettings } from "@/hooks/use-finance-settings";
import { apiFetch } from "@/lib/client-api";
import {
  createBudgetLineDraft,
  hasBudgetLineDraftData,
  type BudgetLineDraft,
  validateBudgetLineDrafts,
} from "@/lib/finance/budget-draft";
import {
  budgetDraftStorageKey,
  type CreateBudgetDraft,
  type CreateBudgetDraftInput,
} from "@/lib/finance/budget-draft-storage";

function defaultMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthDetails(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1, 1);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return {
    name: `${new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(date)} budget`,
    periodStart: `${month}-01`,
    periodEnd: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function CreateBudgetDrawer({ month = defaultMonth() }: { month?: string }) {
  const { userId } = useAuth();
  const [open, setOpen] = useState(false);
  const [budgetMonth, setBudgetMonth] = useState(month);
  const [name, setName] = useState(() => monthDetails(month).name);
  const [lines, setLines] = useState<BudgetLineDraft[]>(() => [createBudgetLineDraft()]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const { mutate } = useSWRConfig();
  const {
    data: categoryData,
    error: categoryError,
    isLoading: categoriesLoading,
  } = useSWR<{ categories: Category[] }>(open ? "/api/categories" : null);
  const { defaultCurrency } = useFinanceSettings();
  const isDirty =
    budgetMonth !== month ||
    name !== monthDetails(month).name ||
    lines.length !== 1 ||
    lines.some(hasBudgetLineDraftData);
  const storageKey = userId ? budgetDraftStorageKey(userId, { kind: "create-budget" }) : null;
  const draft = useMemo<CreateBudgetDraftInput>(
    () => ({ kind: "create-budget", budgetMonth, name, lines }),
    [budgetMonth, lines, name],
  );
  const restoreDraft = useCallback((storedDraft: CreateBudgetDraft) => {
    setBudgetMonth(storedDraft.budgetMonth);
    setName(storedDraft.name);
    setLines(storedDraft.lines);
    setSubmitError("");
  }, []);
  const {
    clearDraft,
    status: draftStatus,
    updatedAt: draftUpdatedAt,
    wasRestored,
  } = useBudgetDraft<CreateBudgetDraft>({
    storageKey,
    kind: "create-budget",
    draft,
    isDirty,
    onRestore: restoreDraft,
  });

  const categories =
    categoryData?.categories.filter(
      (category) => category.kind === "expense" && !category.isArchived,
    ) ?? [];

  function updateLine(clientId: string, changes: Partial<BudgetLineDraft>) {
    setLines((current) =>
      current.map((line) => (line.clientId === clientId ? { ...line, ...changes } : line)),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (event.target !== event.currentTarget) return;

    const validated = validateBudgetLineDrafts(lines);
    if (validated.error) {
      setSubmitError(validated.error);
      toast.error(validated.error);
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      const details = monthDetails(budgetMonth);
      await apiFetch("/api/budgets", {
        method: "POST",
        body: JSON.stringify({
          name: name || details.name,
          periodStart: details.periodStart,
          periodEnd: details.periodEnd,
          currency: defaultCurrency,
          rollover: false,
          items: validated.items,
        }),
      });
      clearDraft();
      setBudgetMonth(month);
      setName(monthDetails(month).name);
      setLines([createBudgetLineDraft()]);
      setOpen(false);
      toast.success("Monthly budget created.");
      try {
        await mutate((key) => typeof key === "string" && key.startsWith("/api/budgets"));
      } catch {
        toast.warning("Budget created, but the page could not refresh. Try again in a moment.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create this budget.";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  function discardDraft() {
    clearDraft();
    setBudgetMonth(month);
    setName(monthDetails(month).name);
    setLines([createBudgetLineDraft()]);
    setSubmitError("");
    toast.success("Unsaved budget draft discarded.");
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} showSwipeHandle>
      <DrawerTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" />
        {isDirty ? "Continue draft" : "New budget"}
      </DrawerTrigger>
      <DrawerContent className="mx-auto max-w-2xl">
        <DrawerHeader>
          <DrawerTitle>Create a monthly budget</DrawerTitle>
          <DrawerDescription>
            Child items roll up into their parent without double-counting.
          </DrawerDescription>
        </DrawerHeader>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="budget-month">Month</FieldLabel>
                  <Input
                    id="budget-month"
                    name="budgetMonth"
                    type="month"
                    value={budgetMonth}
                    onChange={(event) => {
                      setBudgetMonth(event.target.value);
                      setName(monthDetails(event.target.value).name);
                    }}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="budget-name">Budget name</FieldLabel>
                  <Input
                    id="budget-name"
                    name="budgetName"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="off"
                    required
                  />
                </Field>
              </div>

              <div className="flex flex-col gap-4">
                {lines.map((line, index) => {
                  const parentItems = lines
                    .slice(0, index)
                    .filter((candidate) => candidate.name.trim())
                    .map((candidate) => ({
                      value: candidate.clientId,
                      label: candidate.name,
                      icon: "piggy-bank",
                    }));
                  return (
                    <BudgetLineEditor
                      key={line.clientId}
                      line={line}
                      index={index}
                      currency={defaultCurrency}
                      categories={categories}
                      categoriesLoading={categoriesLoading}
                      categoryError={categoryError ? "Refresh and try again." : undefined}
                      parentItems={parentItems}
                      onChange={(changes) => updateLine(line.clientId, changes)}
                      onRemove={
                        lines.length > 1
                          ? () =>
                              setLines((current) =>
                                current
                                  .filter((item) => item.clientId !== line.clientId)
                                  .map((item) =>
                                    item.parentClientId === line.clientId
                                      ? { ...item, parentClientId: "" }
                                      : item,
                                  ),
                              )
                          : undefined
                      }
                    />
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLines((current) => [...current, createBudgetLineDraft()])}
                >
                  <PlusIcon data-icon="inline-start" />
                  Add budget item
                </Button>
              </div>
              {submitError ? (
                <p className="text-xs text-destructive" role="alert" aria-live="polite">
                  {submitError}
                </p>
              ) : null}
              {isDirty ? (
                <BudgetDraftStatus
                  status={draftStatus}
                  updatedAt={draftUpdatedAt}
                  wasRestored={wasRestored}
                  onDiscard={discardDraft}
                />
              ) : null}
            </FieldGroup>
          </div>
          <DrawerFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <PiggyBankIcon data-icon="inline-start" />
              )}
              {submitting ? "Creating…" : "Create budget"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
