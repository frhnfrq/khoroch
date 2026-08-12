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
import { PencilIcon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";

import { BudgetLineEditor } from "@/components/budget-line-editor";
import { BudgetDraftStatus } from "@/components/budget-draft-status";
import { useBudgetDraft } from "@/hooks/use-budget-draft";
import { apiFetch } from "@/lib/client-api";
import {
  createBudgetLineDraft,
  getDescendantClientIds,
  type BudgetLineDraft,
  validateBudgetLineDrafts,
} from "@/lib/finance/budget-draft";
import {
  budgetDraftStorageKey,
  type ManageBudgetDraft,
  type ManageBudgetDraftInput,
} from "@/lib/finance/budget-draft-storage";
import type { BudgetView } from "@/lib/finance/types";

function budgetToDraftLines(budget: BudgetView): BudgetLineDraft[] {
  return budget.items.map((item) => ({
    clientId: item.id,
    id: item.id,
    version: item.version,
    name: item.name,
    plannedAmount: String(item.directPlannedAmount),
    priorSpentAmount: item.directPriorSpentAmount > 0 ? String(item.directPriorSpentAmount) : "",
    hasPriorSpending: item.directPriorSpentAmount > 0,
    categoryId: item.categoryId ?? "",
    parentClientId: item.parentId ?? "",
  }));
}

export function ManageBudgetDrawer({ budget }: { budget: BudgetView }) {
  const { userId } = useAuth();
  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(budget.name);
  const [rollover, setRollover] = useState(budget.rollover);
  const [lines, setLines] = useState<BudgetLineDraft[]>(() => budgetToDraftLines(budget));
  const [draftBaseVersion, setDraftBaseVersion] = useState(budget.version);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
  const serverLines = useMemo(() => budgetToDraftLines(budget), [budget]);
  const isDirty =
    name !== budget.name ||
    rollover !== budget.rollover ||
    JSON.stringify(lines) !== JSON.stringify(serverLines);
  const storageKey = userId
    ? budgetDraftStorageKey(userId, { kind: "manage-budget", budgetId: budget.id })
    : null;
  const draft = useMemo<ManageBudgetDraftInput>(
    () => ({
      kind: "manage-budget",
      budgetId: budget.id,
      baseVersion: draftBaseVersion,
      name,
      rollover,
      lines,
    }),
    [budget.id, draftBaseVersion, lines, name, rollover],
  );
  const restoreDraft = useCallback(
    (storedDraft: ManageBudgetDraft) => {
      if (storedDraft.budgetId !== budget.id) return;
      setName(storedDraft.name);
      setRollover(storedDraft.rollover);
      setLines(storedDraft.lines);
      setDraftBaseVersion(storedDraft.baseVersion);
      setSubmitError("");
    },
    [budget.id],
  );
  const {
    clearDraft,
    status: draftStatus,
    updatedAt: draftUpdatedAt,
    wasRestored,
  } = useBudgetDraft<ManageBudgetDraft>({
    storageKey,
    kind: "manage-budget",
    draft,
    isDirty,
    onRestore: restoreDraft,
  });

  function resetFromBudget() {
    setName(budget.name);
    setRollover(budget.rollover);
    setLines(budgetToDraftLines(budget));
    setDraftBaseVersion(budget.version);
    setSubmitError("");
  }

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen);
  }

  function discardDraft() {
    clearDraft();
    resetFromBudget();
    toast.success("Unsaved budget changes discarded.");
  }

  function updateLine(clientId: string, changes: Partial<BudgetLineDraft>) {
    setLines((current) =>
      current.map((line) => (line.clientId === clientId ? { ...line, ...changes } : line)),
    );
  }

  function removeLine(clientId: string) {
    setLines((current) => {
      const removed = current.find((line) => line.clientId === clientId);
      if (!removed) return current;
      return current
        .filter((line) => line.clientId !== clientId)
        .map((line) =>
          line.parentClientId === clientId
            ? { ...line, parentClientId: removed.parentClientId }
            : line,
        );
    });
  }

  async function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (event.target !== event.currentTarget) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setSubmitError("Enter a budget name.");
      return;
    }
    const validated = validateBudgetLineDrafts(lines, { allowEmpty: true });
    if (validated.error) {
      setSubmitError(validated.error);
      toast.error(validated.error);
      return;
    }

    setSaving(true);
    setSubmitError("");
    try {
      await apiFetch(`/api/budgets/${budget.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: trimmedName,
          rollover,
          version: budget.version,
          items: validated.items,
        }),
      });
      clearDraft();
      setOpen(false);
      toast.success("Budget updated.");
      try {
        await mutate((key) => typeof key === "string" && key.startsWith("/api/budgets"));
      } catch {
        toast.warning("Budget saved, but the page could not refresh. Try again in a moment.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update this budget.";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteBudget() {
    setDeleting(true);
    try {
      await apiFetch(`/api/budgets/${budget.id}`, {
        method: "DELETE",
        body: JSON.stringify({ version: budget.version }),
      });
      clearDraft();
      setDeleteOpen(false);
      setOpen(false);
      toast.success("Budget removed.");
      try {
        await Promise.all([
          mutate((key) => typeof key === "string" && key.startsWith("/api/budgets")),
          mutate((key) => typeof key === "string" && key.startsWith("/api/transactions")),
        ]);
      } catch {
        toast.warning("Budget removed, but the page could not refresh. Try again in a moment.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove this budget.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={changeOpen} showSwipeHandle>
      <DrawerTrigger render={<Button variant="outline" />}>
        <PencilIcon data-icon="inline-start" />
        {isDirty ? "Continue editing" : "Manage budget"}
      </DrawerTrigger>
      <DrawerContent className="mx-auto max-w-2xl">
        <DrawerHeader>
          <DrawerTitle>Manage {budget.name}</DrawerTitle>
          <DrawerDescription>
            Edit the group, add or remove items, and record spending from before tracking began.
          </DrawerDescription>
        </DrawerHeader>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={saveBudget}>
          <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
            <FieldGroup>
              <Field data-invalid={Boolean(submitError && !name.trim())}>
                <FieldLabel htmlFor={`budget-group-name-${budget.id}`}>Budget name</FieldLabel>
                <Input
                  id={`budget-group-name-${budget.id}`}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setSubmitError("");
                  }}
                  autoComplete="off"
                  maxLength={100}
                  aria-invalid={Boolean(submitError && !name.trim())}
                />
              </Field>

              <Field orientation="horizontal" className="rounded-xl border bg-muted/30 p-3">
                <div className="flex flex-col gap-0.5">
                  <FieldTitle>Rollover</FieldTitle>
                  <FieldDescription>
                    Keep unused planned money available next month.
                  </FieldDescription>
                </div>
                <Switch
                  aria-label="Roll unused budget money into next month"
                  checked={rollover}
                  onCheckedChange={setRollover}
                />
              </Field>

              <div className="flex flex-col gap-4">
                {lines.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-5 text-center">
                    <p className="text-sm font-medium">This budget has no items</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add an item below, or save the empty group and fill it in later.
                    </p>
                  </div>
                ) : null}
                {lines.map((line, index) => {
                  const excludedIds = getDescendantClientIds(lines, line.clientId);
                  excludedIds.add(line.clientId);
                  const parentItems = lines
                    .filter((candidate) => !excludedIds.has(candidate.clientId))
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
                      currency={budget.currency}
                      categories={categories}
                      categoriesLoading={categoriesLoading}
                      categoryError={categoryError ? "Refresh and try again." : undefined}
                      parentItems={parentItems}
                      onChange={(changes) => updateLine(line.clientId, changes)}
                      onRemove={() => removeLine(line.clientId)}
                    />
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLines((current) => [...current, createBudgetLineDraft()])}
                >
                  <PlusIcon data-icon="inline-start" />
                  Add budget item
                </Button>
              </div>

              {submitError ? <FieldError>{submitError}</FieldError> : null}
              {isDirty ? (
                <BudgetDraftStatus
                  status={draftStatus}
                  updatedAt={draftUpdatedAt}
                  wasRestored={wasRestored}
                  stale={draftBaseVersion !== budget.version}
                  onDiscard={discardDraft}
                />
              ) : null}
            </FieldGroup>
          </div>

          <DrawerFooter className="sm:flex-row sm:justify-between">
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogTrigger
                render={<Button type="button" variant="destructive" disabled={saving} />}
              >
                <Trash2Icon data-icon="inline-start" />
                Delete budget
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {budget.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The budget and its items will disappear from planning. Linked activities remain
                    in the ledger, so account balances and transaction history stay intact.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Keep budget</AlertDialogCancel>
                  <AlertDialogAction
                    type="button"
                    variant="destructive"
                    disabled={deleting}
                    onClick={deleteBudget}
                  >
                    {deleting ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <Trash2Icon data-icon="inline-start" />
                    )}
                    {deleting ? "Deleting…" : "Delete budget"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button type="submit" disabled={saving || deleting}>
              {saving ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <SaveIcon data-icon="inline-start" />
              )}
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
