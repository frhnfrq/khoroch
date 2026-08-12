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
import { FieldError, FieldGroup } from "@khoroch/ui/components/field";
import { Spinner } from "@khoroch/ui/components/spinner";
import { PencilIcon, PlusIcon, SaveIcon } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";

import { BudgetLineFields } from "@/components/budget-line-editor";
import { apiFetch } from "@/lib/client-api";
import {
  createBudgetLineDraft,
  validateBudgetLineDrafts,
  type BudgetLineDraft,
} from "@/lib/finance/budget-draft";
import { getBudgetItemDescendantIds } from "@/lib/finance/budget-item-parent";
import type { BudgetItemView, BudgetView } from "@/lib/finance/types";

function itemToDraft(item: BudgetItemView): BudgetLineDraft {
  return {
    clientId: item.id,
    id: item.id,
    version: item.version,
    name: item.name,
    plannedAmount: String(item.directPlannedAmount),
    priorSpentAmount: item.directPriorSpentAmount > 0 ? String(item.directPriorSpentAmount) : "",
    hasPriorSpending: item.directPriorSpentAmount > 0,
    categoryId: item.categoryId ?? "",
    parentClientId: item.parentId ?? "",
  };
}

export function BudgetItemDrawer({ budget, item }: { budget: BudgetView; item?: BudgetItemView }) {
  const editing = Boolean(item);
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState<BudgetLineDraft>(() =>
    item ? itemToDraft(item) : createBudgetLineDraft(),
  );
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const { mutate } = useSWRConfig();
  const {
    data: categoryData,
    error: categoryError,
    isLoading: categoriesLoading,
  } = useSWR<{ categories: Category[] }>(open ? "/api/categories" : null);
  const categories =
    categoryData?.categories.filter(
      (category) => category.kind === "expense" && !category.isArchived,
    ) ?? [];
  const parentItems = useMemo(() => {
    const excludedIds = item
      ? getBudgetItemDescendantIds(budget.items, item.id)
      : new Set<string>();
    if (item) excludedIds.add(item.id);

    return budget.items
      .filter((candidate) => !excludedIds.has(candidate.id))
      .map((candidate) => ({
        value: candidate.id,
        label: candidate.name,
        description: candidate.category?.name ?? "Uncategorized",
        icon: candidate.category?.icon ?? "piggy-bank",
      }));
  }, [budget.items, item]);

  function changeOpen(nextOpen: boolean) {
    if (nextOpen) {
      setLine(item ? itemToDraft(item) : createBudgetLineDraft());
      setSubmitError("");
    }
    setOpen(nextOpen);
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validated = validateBudgetLineDrafts([line], {
      externalParentIds: budget.items.map((candidate) => candidate.id),
    });
    if (validated.items === null) {
      setSubmitError(validated.error);
      return;
    }

    const payload = validated.items[0];
    if (!payload) {
      setSubmitError("Complete the budget item before saving.");
      return;
    }

    setSaving(true);
    setSubmitError("");
    try {
      await apiFetch(
        editing ? `/api/budgets/${budget.id}/items/${item?.id}` : `/api/budgets/${budget.id}/items`,
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify({
            budgetVersion: budget.version,
            ...(item ? { version: item.version } : {}),
            name: payload.name,
            plannedAmount: payload.plannedAmount,
            priorSpentAmount: payload.priorSpentAmount,
            categoryId: payload.categoryId,
            parentId: payload.parentClientId,
          }),
        },
      );
      setOpen(false);
      toast.success(editing ? "Budget item updated." : "Budget item added.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save this budget item.";
      setSubmitError(message);
      toast.error(message);
      setSaving(false);
      return;
    }

    try {
      await Promise.all([
        mutate((key) => typeof key === "string" && key.startsWith("/api/budgets")),
        mutate((key) => typeof key === "string" && key.startsWith("/api/transactions")),
      ]);
    } catch {
      toast.warning("The item was saved, but the latest budget could not be loaded yet.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={changeOpen} showSwipeHandle>
      <DrawerTrigger render={<Button variant={editing ? "outline" : "default"} />}>
        {editing ? <PencilIcon data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
        {editing ? "Edit item" : "Add item"}
      </DrawerTrigger>
      <DrawerContent className="mx-auto max-w-xl">
        <DrawerHeader>
          <DrawerTitle>{editing ? `Edit ${item?.name}` : "Add a budget item"}</DrawerTitle>
          <DrawerDescription>
            {editing
              ? "Update only this item without reopening or resaving the full budget."
              : `Add one item directly to ${budget.name}.`}
          </DrawerDescription>
        </DrawerHeader>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={saveItem}>
          <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
            <FieldGroup>
              <BudgetLineFields
                line={line}
                index={0}
                currency={budget.currency}
                categories={categories}
                categoriesLoading={categoriesLoading}
                categoryError={categoryError ? "Refresh and try again." : undefined}
                parentItems={parentItems}
                onChange={(changes) => {
                  setLine((current) => ({ ...current, ...changes }));
                  setSubmitError("");
                }}
              />
              {submitError ? <FieldError>{submitError}</FieldError> : null}
            </FieldGroup>
          </div>

          <DrawerFooter>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Spinner data-icon="inline-start" />
              ) : editing ? (
                <SaveIcon data-icon="inline-start" />
              ) : (
                <PlusIcon data-icon="inline-start" />
              )}
              {saving ? "Saving…" : editing ? "Save item" : "Add item"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
