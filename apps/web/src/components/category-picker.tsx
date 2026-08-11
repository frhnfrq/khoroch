"use client";

import type { Category } from "@khoroch/db/schema";
import { useMemo, useState } from "react";
import { useSWRConfig } from "swr";

import { CreateCategoryDrawer } from "@/components/create-category-drawer";
import { SearchPicker } from "@/components/search-picker";
import { getCategoryPath } from "@/lib/finance/category-tree";

export function CategoryPicker({
  categories,
  kind,
  value,
  onValueChange,
  loading = false,
  errorMessage,
  optional = false,
  disabled = false,
}: {
  categories: Category[];
  kind: "expense" | "income";
  value: string;
  onValueChange: (value: string) => void;
  loading?: boolean;
  errorMessage?: string;
  optional?: boolean;
  disabled?: boolean;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const { mutate } = useSWRConfig();
  const items = useMemo(
    () =>
      categories
        .filter((category) => category.kind === kind && !category.isArchived)
        .map((category) => ({
          value: category.id,
          label: getCategoryPath(category, categories),
          description: category.isSystem ? "Built-in category" : "Custom category",
          icon: category.icon,
        })),
    [categories, kind],
  );

  return (
    <>
      <SearchPicker
        title="Choose a category"
        description="Search by category or its parent path."
        placeholder={optional ? "Optional category" : "Choose category"}
        searchPlaceholder="Search categories…"
        emptyMessage="No categories match this search."
        items={items}
        value={value}
        onValueChange={onValueChange}
        loading={loading}
        errorMessage={errorMessage}
        disabled={disabled}
        clearable={optional}
        onCreate={() => setCreateOpen(true)}
        createLabel="Add category"
      />
      <CreateCategoryDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultKind={kind}
        lockKind
        onCreated={async (category) => {
          await mutate("/api/categories");
          onValueChange(category.id);
        }}
      />
    </>
  );
}
