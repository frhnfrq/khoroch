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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@khoroch/ui/components/field";
import { Input } from "@khoroch/ui/components/input";
import { Spinner } from "@khoroch/ui/components/spinner";
import { ToggleGroup, ToggleGroupItem } from "@khoroch/ui/components/toggle-group";
import { FolderPlusIcon, PlusIcon } from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";

import { categoryIconOptions } from "@/components/finance-icon";
import { SearchPicker } from "@/components/search-picker";
import { apiFetch } from "@/lib/client-api";
import { getCategoryPath } from "@/lib/finance/category-tree";

type CategoryKind = "expense" | "income";

export function CreateCategoryDrawer({
  trigger,
  open: controlledOpen,
  onOpenChange,
  defaultKind = "expense",
  lockKind = false,
  onCreated,
}: {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultKind?: CategoryKind;
  lockKind?: boolean;
  onCreated?: (category: Category) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<CategoryKind>(defaultKind);
  const [parentId, setParentId] = useState("");
  const [icon, setIcon] = useState("circle-dot");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const { mutate } = useSWRConfig();
  const { data, error, isLoading } = useSWR<{ categories: Category[] }>(
    open ? "/api/categories" : null,
  );
  const categories = data?.categories.filter((category) => !category.isArchived) ?? [];
  const parentItems = useMemo(
    () =>
      categories
        .filter((category) => category.kind === kind)
        .map((category) => ({
          value: category.id,
          label: getCategoryPath(category, categories),
          description: category.isSystem ? "Built-in category" : "Custom category",
          icon: category.icon,
        })),
    [categories, kind],
  );
  const iconItems = useMemo(
    () => categoryIconOptions.map((item) => ({ ...item, icon: item.value })),
    [],
  );

  function reset() {
    setName("");
    setKind(defaultKind);
    setParentId("");
    setIcon("circle-dot");
    setSubmitError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setSubmitError("Enter a category name.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await apiFetch<{ category: Category }>("/api/categories", {
        method: "POST",
        body: JSON.stringify({
          name: trimmedName,
          kind,
          parentId: parentId || null,
          icon,
          color: kind === "income" ? "emerald" : "violet",
        }),
      });
      await mutate("/api/categories");
      toast.success(`“${result.category.name}” added.`);
      onCreated?.(result.category);
      reset();
      setOpen(false);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Could not add this category.";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen && !submitting) reset();
      }}
      showSwipeHandle
    >
      {trigger ? (
        <DrawerTrigger render={<Button type="button" />}>
          <PlusIcon data-icon="inline-start" />
          {trigger}
        </DrawerTrigger>
      ) : null}
      <DrawerContent className="mx-auto max-w-xl">
        <DrawerHeader>
          <DrawerTitle>Add a category</DrawerTitle>
          <DrawerDescription>
            Choose an icon and optionally place it under a parent.
          </DrawerDescription>
        </DrawerHeader>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
            <FieldGroup>
              {!lockKind ? (
                <Field>
                  <FieldLabel>Category type</FieldLabel>
                  <ToggleGroup
                    value={[kind]}
                    onValueChange={(values) => {
                      const nextKind = values[0] as CategoryKind | undefined;
                      if (nextKind) {
                        setKind(nextKind);
                        setParentId("");
                      }
                    }}
                    variant="outline"
                    className="grid w-full grid-cols-2"
                  >
                    <ToggleGroupItem value="expense">Expense</ToggleGroupItem>
                    <ToggleGroupItem value="income">Income</ToggleGroupItem>
                  </ToggleGroup>
                </Field>
              ) : null}

              <Field data-invalid={Boolean(submitError && !name.trim())}>
                <FieldLabel htmlFor="category-name">Name</FieldLabel>
                <Input
                  id="category-name"
                  name="categoryName"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setSubmitError("");
                  }}
                  placeholder="Dining, Fuel, Tuition…"
                  autoComplete="off"
                  maxLength={80}
                  aria-invalid={Boolean(submitError && !name.trim())}
                />
              </Field>

              <Field>
                <FieldLabel>Icon</FieldLabel>
                <SearchPicker
                  title="Choose an icon"
                  description="Icons make categories quicker to scan."
                  placeholder="Choose icon"
                  searchPlaceholder="Search icons…"
                  items={iconItems}
                  value={icon}
                  onValueChange={setIcon}
                />
              </Field>

              <Field>
                <FieldLabel>Parent category</FieldLabel>
                <SearchPicker
                  title="Choose a parent"
                  description="Leave empty for a top-level category."
                  placeholder="Top level"
                  searchPlaceholder="Search categories…"
                  emptyMessage="No parent categories match this search."
                  items={parentItems}
                  value={parentId}
                  onValueChange={setParentId}
                  loading={isLoading}
                  errorMessage={error ? "Refresh and try again." : undefined}
                  clearable
                />
                <FieldDescription>
                  Subcategories appear with their full parent path.
                </FieldDescription>
              </Field>

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
                <FolderPlusIcon data-icon="inline-start" />
              )}
              {submitting ? "Adding…" : "Add category"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
