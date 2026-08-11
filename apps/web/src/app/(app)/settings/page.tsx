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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@khoroch/ui/components/field";
import { Separator } from "@khoroch/ui/components/separator";
import { Skeleton } from "@khoroch/ui/components/skeleton";
import { Spinner } from "@khoroch/ui/components/spinner";
import { CircleAlertIcon, SaveIcon, Settings2Icon } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { CreateCategoryDrawer } from "@/components/create-category-drawer";
import { FinanceIcon } from "@/components/finance-icon";
import { SearchPicker } from "@/components/search-picker";
import { apiFetch } from "@/lib/client-api";
import { getCategoryPath } from "@/lib/finance/category-tree";
import { currencyOptions, getCurrencyPrefix } from "@/lib/finance/currencies";
import type { FinanceSettings } from "@/lib/finance/types";

export default function SettingsPage() {
  const {
    data: settingsData,
    error: settingsError,
    isLoading: settingsLoading,
    mutate: mutateSettings,
  } = useSWR<{ settings: FinanceSettings }>("/api/settings");
  const {
    data: categoryData,
    error: categoryError,
    isLoading: categoriesLoading,
    mutate: mutateCategories,
  } = useSWR<{ categories: Category[] }>("/api/categories");
  const [defaultCurrency, setDefaultCurrency] = useState("BDT");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (settingsData?.settings.defaultCurrency) {
      setDefaultCurrency(settingsData.settings.defaultCurrency);
    }
  }, [settingsData]);

  const categories = categoryData?.categories.filter((category) => !category.isArchived) ?? [];
  const categoryGroups = useMemo(
    () =>
      (["expense", "income"] as const).map((kind) => ({
        kind,
        label: kind === "expense" ? "Expense categories" : "Income categories",
        categories: categories
          .filter((category) => category.kind === kind)
          .toSorted((left, right) =>
            getCategoryPath(left, categories).localeCompare(getCategoryPath(right, categories)),
          ),
      })),
    [categories],
  );

  async function saveCurrency(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      const result = await apiFetch<{ settings: FinanceSettings }>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          defaultCurrency,
          version: settingsData?.settings.version,
        }),
      });
      await mutateSettings({ settings: result.settings }, { revalidate: false });
      toast.success("Default currency updated.");
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Could not save your settings.";
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-balance">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Choose defaults and keep your category library organized.
        </p>
      </div>

      <section className="flex max-w-2xl flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">Money</h2>
          <p className="text-xs text-muted-foreground">
            The default applies to new accounts and budgets. Existing balances are not converted.
          </p>
        </div>
        {settingsLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-32" />
          </div>
        ) : settingsError ? (
          <Empty className="min-h-48">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CircleAlertIcon />
              </EmptyMedia>
              <EmptyTitle>Could not load settings</EmptyTitle>
              <EmptyDescription>Check the connection, then try again.</EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" onClick={() => void mutateSettings()}>
              Try again
            </Button>
          </Empty>
        ) : (
          <form onSubmit={saveCurrency}>
            <FieldGroup>
              <Field>
                <FieldLabel>Default currency</FieldLabel>
                <SearchPicker
                  title="Choose a currency"
                  description="This prefix appears in new money fields."
                  placeholder="Choose currency"
                  searchPlaceholder="Search currencies…"
                  items={currencyOptions.map((currency) => ({
                    value: currency.value,
                    label: currency.label,
                    description: currency.description,
                  }))}
                  value={defaultCurrency}
                  onValueChange={setDefaultCurrency}
                />
                <FieldDescription>
                  New accounts and budgets will use {defaultCurrency} (
                  {getCurrencyPrefix(defaultCurrency)}).
                </FieldDescription>
              </Field>
              {saveError ? (
                <p className="text-xs text-destructive" role="alert" aria-live="polite">
                  {saveError}
                </p>
              ) : null}
              <Button type="submit" className="self-start" disabled={saving}>
                {saving ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <SaveIcon data-icon="inline-start" />
                )}
                {saving ? "Saving…" : "Save currency"}
              </Button>
            </FieldGroup>
          </form>
        )}
      </section>

      <Separator />

      <section className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold">Categories</h2>
            <p className="text-xs text-muted-foreground">
              Icons and full parent paths appear everywhere you choose a category.
            </p>
          </div>
          <CreateCategoryDrawer trigger="Add category" />
        </div>

        {categoriesLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : categoryError ? (
          <Empty className="min-h-48">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Settings2Icon />
              </EmptyMedia>
              <EmptyTitle>Could not load categories</EmptyTitle>
              <EmptyDescription>Refresh the list and try again.</EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" onClick={() => void mutateCategories()}>
              Try again
            </Button>
          </Empty>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {categoryGroups.map((group) => (
              <div key={group.kind} className="flex flex-col gap-2">
                <h3 className="text-xs font-medium text-muted-foreground">{group.label}</h3>
                <div className="flex flex-col">
                  {group.categories.map((category, index) => (
                    <div key={category.id}>
                      <div className="flex items-center gap-3 py-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <FinanceIcon name={category.icon} />
                        </span>
                        <p className="min-w-0 flex-1 truncate text-sm">
                          {getCategoryPath(category, categories)}
                        </p>
                        <Badge variant="secondary">
                          {category.isSystem ? "Built-in" : "Custom"}
                        </Badge>
                      </div>
                      {index < group.categories.length - 1 ? <Separator /> : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
