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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@khoroch/ui/components/field";
import { Input } from "@khoroch/ui/components/input";
import { Spinner } from "@khoroch/ui/components/spinner";
import { LandmarkIcon, PlusIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";

import { apiFetch } from "@/lib/client-api";
import { MoneyInput } from "@/components/money-input";
import { SearchPicker } from "@/components/search-picker";
import { useFinanceSettings } from "@/hooks/use-finance-settings";

const accountTypeItems = [
  { value: "mobile_wallet", label: "Mobile wallet", icon: "smartphone" },
  { value: "bank", label: "Bank account", icon: "landmark" },
  { value: "cash", label: "Cash", icon: "banknote" },
  { value: "savings", label: "Savings", icon: "wallet-cards" },
  { value: "credit_card", label: "Credit card", icon: "credit-card" },
  { value: "other", label: "Other", icon: "wallet" },
] as const;

const accountAppearance = {
  mobile_wallet: { icon: "smartphone", color: "violet" },
  bank: { icon: "landmark", color: "blue" },
  cash: { icon: "banknote", color: "emerald" },
  savings: { icon: "wallet-cards", color: "cyan" },
  credit_card: { icon: "credit-card", color: "pink" },
  other: { icon: "wallet", color: "slate" },
} as const;

type AccountType = keyof typeof accountAppearance;

export function CreateAccountDrawer() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("mobile_wallet");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const { mutate } = useSWRConfig();
  const { defaultCurrency, isLoading: settingsLoading } = useFinanceSettings();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setSubmitError("Enter an account name.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      await apiFetch("/api/accounts", {
        method: "POST",
        body: JSON.stringify({
          name,
          type,
          openingBalance: Number(openingBalance || 0),
          currency: defaultCurrency,
          ...accountAppearance[type],
        }),
      });
      await mutate("/api/accounts");
      toast.success(`${name} added.`);
      setName("");
      setOpeningBalance("0");
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not add this account.";
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
        Add account
      </DrawerTrigger>
      <DrawerContent className="mx-auto max-w-lg">
        <DrawerHeader>
          <DrawerTitle>Add an account</DrawerTitle>
          <DrawerDescription>Use the balance you can verify right now.</DrawerDescription>
        </DrawerHeader>
        <form onSubmit={handleSubmit}>
          <div className="px-4 pb-6">
            <FieldGroup>
              <Field data-invalid={Boolean(submitError && !name.trim())}>
                <FieldLabel htmlFor="account-name">Account name</FieldLabel>
                <Input
                  id="account-name"
                  name="accountName"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setSubmitError("");
                  }}
                  placeholder="bKash, City Bank, Cash…"
                  autoComplete="off"
                  maxLength={80}
                  aria-invalid={Boolean(submitError && !name.trim())}
                />
              </Field>
              <Field>
                <FieldLabel>Account type</FieldLabel>
                <SearchPicker
                  title="Choose an account type"
                  description="Pick the option that best matches where the money is held."
                  placeholder="Choose account type"
                  searchPlaceholder="Search account types…"
                  items={[...accountTypeItems]}
                  value={type}
                  onValueChange={(value) => setType(value as AccountType)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="opening-balance">Opening balance</FieldLabel>
                <MoneyInput
                  id="opening-balance"
                  name="openingBalance"
                  currency={defaultCurrency}
                  step="0.01"
                  value={openingBalance}
                  onChange={(event) => setOpeningBalance(event.target.value)}
                  disabled={settingsLoading}
                />
                <FieldDescription>
                  This anchors the ledger. Later differences should be recorded as adjustments.
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
                <LandmarkIcon data-icon="inline-start" />
              )}
              {submitting ? "Adding…" : "Add account"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
