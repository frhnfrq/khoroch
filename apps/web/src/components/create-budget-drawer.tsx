"use client";

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
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";

import { apiFetch, createClientRequestId } from "@/lib/client-api";
import { CategoryPicker } from "@/components/category-picker";
import { MoneyInput } from "@/components/money-input";
import { SearchPicker } from "@/components/search-picker";
import { SubItemPanel } from "@/components/sub-item-panel";
import { useFinanceSettings } from "@/hooks/use-finance-settings";

type BudgetLine = {
  clientId: string;
  name: string;
  plannedAmount: string;
  categoryId: string;
  parentClientId: string;
};

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

function newLine(): BudgetLine {
  return {
    clientId: createClientRequestId(),
    name: "",
    plannedAmount: "",
    categoryId: "",
    parentClientId: "",
  };
}

export function CreateBudgetDrawer({ month = defaultMonth() }: { month?: string }) {
  const [open, setOpen] = useState(false);
  const [budgetMonth, setBudgetMonth] = useState(month);
  const [name, setName] = useState(() => monthDetails(month).name);
  const [lines, setLines] = useState<BudgetLine[]>(() => [newLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const { mutate } = useSWRConfig();
  const {
    data: categoryData,
    error: categoryError,
    isLoading: categoriesLoading,
  } = useSWR<{ categories: Category[] }>(open ? "/api/categories" : null);
  const { defaultCurrency } = useFinanceSettings();

  const categories =
    categoryData?.categories.filter(
      (category) => category.kind === "expense" && !category.isArchived,
    ) ?? [];

  useEffect(() => {
    if (open) return;
    setBudgetMonth(month);
    setName(monthDetails(month).name);
  }, [month, open]);

  function updateLine(clientId: string, changes: Partial<BudgetLine>) {
    setLines((current) =>
      current.map((line) => (line.clientId === clientId ? { ...line, ...changes } : line)),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validLines = lines.filter((line) => line.name.trim() && Number(line.plannedAmount) >= 0);
    if (validLines.length === 0) {
      const message = "Add at least one budget item with a planned amount.";
      setSubmitError(message);
      toast.error(message);
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
          items: validLines.map((line) => ({
            clientId: line.clientId,
            parentClientId: line.parentClientId || null,
            categoryId: line.categoryId || null,
            name: line.name,
            plannedAmount: Number(line.plannedAmount || 0),
          })),
        }),
      });
      await mutate((key) => typeof key === "string" && key.startsWith("/api/budgets"));
      toast.success("Monthly budget created.");
      setLines([newLine()]);
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create this budget.";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} showSwipeHandle>
      <DrawerTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" />
        New budget
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
                    <SubItemPanel
                      key={line.clientId}
                      index={index}
                      label={line.name.trim() || "Budget item"}
                      nested={Boolean(line.parentClientId)}
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
                    >
                      <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
                        <Field>
                          <FieldLabel htmlFor={`budget-name-${line.clientId}`}>Name</FieldLabel>
                          <Input
                            id={`budget-name-${line.clientId}`}
                            name={`budgetItemName${index + 1}`}
                            value={line.name}
                            onChange={(event) =>
                              updateLine(line.clientId, { name: event.target.value })
                            }
                            placeholder="Groceries, Office, Tour…"
                            autoComplete="off"
                            required={index === 0}
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor={`budget-amount-${line.clientId}`}>
                            Planned
                          </FieldLabel>
                          <MoneyInput
                            id={`budget-amount-${line.clientId}`}
                            name={`budgetItemAmount${index + 1}`}
                            currency={defaultCurrency}
                            min="0"
                            step="0.01"
                            value={line.plannedAmount}
                            onChange={(event) =>
                              updateLine(line.clientId, { plannedAmount: event.target.value })
                            }
                            required={index === 0}
                          />
                        </Field>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field>
                          <FieldLabel>Category</FieldLabel>
                          <CategoryPicker
                            categories={categories}
                            kind="expense"
                            value={line.categoryId}
                            onValueChange={(value) =>
                              updateLine(line.clientId, { categoryId: value })
                            }
                            loading={categoriesLoading}
                            errorMessage={categoryError ? "Refresh and try again." : undefined}
                            optional
                          />
                        </Field>
                        <Field>
                          <FieldLabel>Parent budget</FieldLabel>
                          <SearchPicker
                            title="Choose a parent budget item"
                            description="This item’s spending will roll up to its parent."
                            placeholder="Top level"
                            searchPlaceholder="Search budget items…"
                            emptyMessage="Name an earlier item before choosing it as a parent."
                            items={parentItems}
                            value={line.parentClientId}
                            onValueChange={(value) =>
                              updateLine(line.clientId, { parentClientId: value })
                            }
                            disabled={parentItems.length === 0}
                            clearable
                          />
                        </Field>
                      </div>
                      {line.parentClientId ? (
                        <p className="text-xs text-muted-foreground">
                          Nested spending counts once and appears under the parent total.
                        </p>
                      ) : null}
                    </SubItemPanel>
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLines((current) => [...current, newLine()])}
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
