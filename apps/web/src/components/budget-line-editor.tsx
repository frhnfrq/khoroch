"use client";

import type { Category } from "@khoroch/db/schema";
import { Field, FieldDescription, FieldLabel, FieldTitle } from "@khoroch/ui/components/field";
import { Input } from "@khoroch/ui/components/input";
import { Switch } from "@khoroch/ui/components/switch";

import { CategoryPicker } from "@/components/category-picker";
import { MoneyInput } from "@/components/money-input";
import { SearchPicker, type SearchPickerItem } from "@/components/search-picker";
import { SubItemPanel } from "@/components/sub-item-panel";
import type { BudgetLineDraft } from "@/lib/finance/budget-draft";

type BudgetLineFieldsProps = {
  line: BudgetLineDraft;
  index: number;
  currency: string;
  categories: Category[];
  categoriesLoading: boolean;
  categoryError?: string;
  parentItems: SearchPickerItem[];
  onChange: (changes: Partial<BudgetLineDraft>) => void;
};

export function BudgetLineFields({
  line,
  index,
  currency,
  categories,
  categoriesLoading,
  categoryError,
  parentItems,
  onChange,
}: BudgetLineFieldsProps) {
  const label = line.name.trim() || "Budget item";

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
        <Field>
          <FieldLabel htmlFor={`budget-name-${line.clientId}`}>Name</FieldLabel>
          <Input
            id={`budget-name-${line.clientId}`}
            name={`budgetItemName${index + 1}`}
            value={line.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="Groceries, Office, Tour…"
            autoComplete="off"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`budget-amount-${line.clientId}`}>Planned</FieldLabel>
          <MoneyInput
            id={`budget-amount-${line.clientId}`}
            name={`budgetItemAmount${index + 1}`}
            currency={currency}
            min="0"
            step="0.01"
            value={line.plannedAmount}
            onChange={(event) => onChange({ plannedAmount: event.target.value })}
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
            onValueChange={(value) => onChange({ categoryId: value })}
            loading={categoriesLoading}
            errorMessage={categoryError}
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
            emptyMessage="No eligible parent items are available."
            items={parentItems}
            value={line.parentClientId}
            onValueChange={(value) => onChange({ parentClientId: value })}
            disabled={parentItems.length === 0}
            clearable
          />
        </Field>
      </div>

      <Field orientation="horizontal" className="rounded-xl border bg-background p-3">
        <div className="flex flex-col gap-0.5">
          <FieldTitle>Already spent before tracking</FieldTitle>
          <FieldDescription>
            Count prior progress in this budget without changing an account balance.
          </FieldDescription>
        </div>
        <Switch
          aria-label={`Mark ${label} as already spent before tracking`}
          checked={line.hasPriorSpending}
          onCheckedChange={(checked) =>
            onChange({
              hasPriorSpending: checked,
              priorSpentAmount: checked ? line.priorSpentAmount || line.plannedAmount || "0" : "",
            })
          }
        />
      </Field>

      {line.hasPriorSpending ? (
        <Field>
          <FieldLabel htmlFor={`budget-prior-spent-${line.clientId}`}>
            Spent before tracking
          </FieldLabel>
          <MoneyInput
            id={`budget-prior-spent-${line.clientId}`}
            name={`budgetItemPriorSpent${index + 1}`}
            currency={currency}
            min="0"
            step="0.01"
            value={line.priorSpentAmount}
            onChange={(event) => onChange({ priorSpentAmount: event.target.value })}
          />
          <FieldDescription>
            This amount contributes to budget progress only and is labeled as prior spending.
          </FieldDescription>
        </Field>
      ) : null}
    </>
  );
}

export function BudgetLineEditor({
  onRemove,
  ...props
}: BudgetLineFieldsProps & { onRemove?: () => void }) {
  const label = props.line.name.trim() || "Budget item";

  return (
    <SubItemPanel
      index={props.index}
      label={label}
      nested={Boolean(props.line.parentClientId)}
      onRemove={onRemove}
    >
      <BudgetLineFields {...props} />
    </SubItemPanel>
  );
}
