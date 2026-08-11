"use client";

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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@khoroch/ui/components/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@khoroch/ui/components/input-group";
import { Skeleton } from "@khoroch/ui/components/skeleton";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  CircleAlertIcon,
  ListFilterIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

import { FinanceIcon } from "@/components/finance-icon";

export type SearchPickerItem = {
  value: string;
  label: string;
  description?: string;
  icon?: string;
  keywords?: string;
};

export function SearchPicker({
  title,
  description,
  placeholder,
  searchPlaceholder = "Search…",
  emptyMessage = "No matching items.",
  items,
  value,
  onValueChange,
  loading = false,
  errorMessage,
  disabled = false,
  clearable = false,
  onCreate,
  createLabel = "Add new",
}: {
  title: string;
  description?: string;
  placeholder: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  items: SearchPickerItem[];
  value: string;
  onValueChange: (value: string) => void;
  loading?: boolean;
  errorMessage?: string;
  disabled?: boolean;
  clearable?: boolean;
  onCreate?: () => void;
  createLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const selectedItem = items.find((item) => item.value === value) ?? null;
  const filteredItems = useMemo(() => {
    if (!deferredQuery) return items;
    return items.filter((item) =>
      `${item.label} ${item.description ?? ""} ${item.keywords ?? ""}`
        .toLocaleLowerCase()
        .includes(deferredQuery),
    );
  }, [deferredQuery, items]);

  function select(nextValue: string) {
    onValueChange(nextValue);
    setOpen(false);
    setQuery("");
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
      showSwipeHandle
    >
      <DrawerTrigger
        disabled={disabled}
        render={<Button type="button" variant="outline" className="h-auto min-h-10 w-full" />}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {selectedItem?.icon ? <FinanceIcon name={selectedItem.icon} /> : null}
          <span className="min-w-0 flex-1">
            <span className="block truncate">
              {loading && !selectedItem ? "Loading…" : (selectedItem?.label ?? placeholder)}
            </span>
            {selectedItem?.description ? (
              <span className="block truncate text-[0.65rem] font-normal text-muted-foreground">
                {selectedItem.description}
              </span>
            ) : null}
          </span>
        </span>
        <ChevronsUpDownIcon data-icon="inline-end" />
      </DrawerTrigger>

      <DrawerContent className="mx-auto max-h-[min(85svh,48rem)] max-w-xl">
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>
            {description ?? `Search and choose ${title.toLowerCase()}.`}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4 pt-4">
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder.replace("…", "")}
              autoComplete="off"
            />
          </InputGroup>

          <div className="scroll-fade-b flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain">
            {loading ? (
              <div className="flex flex-col gap-2" aria-label="Loading choices">
                {Array.from({ length: 5 }, (_, index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </div>
            ) : errorMessage ? (
              <Empty className="min-h-52">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CircleAlertIcon />
                  </EmptyMedia>
                  <EmptyTitle>Could not load choices</EmptyTitle>
                  <EmptyDescription>{errorMessage}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : filteredItems.length === 0 ? (
              <Empty className="min-h-52">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ListFilterIcon />
                  </EmptyMedia>
                  <EmptyTitle>No results</EmptyTitle>
                  <EmptyDescription>{emptyMessage}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              filteredItems.map((item) => (
                <Button
                  key={item.value}
                  type="button"
                  variant={item.value === value ? "secondary" : "ghost"}
                  size="lg"
                  className="h-auto w-full justify-start px-3 py-3 text-left"
                  onClick={() => select(item.value)}
                >
                  {item.icon ? <FinanceIcon name={item.icon} /> : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.label}</span>
                    {item.description ? (
                      <span className="block truncate text-[0.65rem] font-normal text-muted-foreground">
                        {item.description}
                      </span>
                    ) : null}
                  </span>
                  {item.value === value ? <CheckIcon data-icon="inline-end" /> : null}
                </Button>
              ))
            )}
          </div>
        </div>

        {onCreate || (clearable && value) ? (
          <DrawerFooter className="flex-row border-t pt-3">
            {clearable && value ? (
              <Button type="button" variant="outline" className="flex-1" onClick={() => select("")}>
                Clear selection
              </Button>
            ) : null}
            {onCreate ? (
              <Button
                type="button"
                className="flex-1"
                onClick={() => {
                  setOpen(false);
                  onCreate();
                }}
              >
                <PlusIcon data-icon="inline-start" />
                {createLabel}
              </Button>
            ) : null}
          </DrawerFooter>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
