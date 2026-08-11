"use client";

import { InputGroup, InputGroupAddon, InputGroupInput } from "@khoroch/ui/components/input-group";
import type { ComponentProps } from "react";

import { getCurrencyPrefix } from "@/lib/finance/currencies";

export function MoneyInput({
  currency = "BDT",
  ...props
}: Omit<ComponentProps<typeof InputGroupInput>, "type" | "inputMode"> & {
  currency?: string;
}) {
  return (
    <InputGroup>
      <InputGroupAddon>{getCurrencyPrefix(currency)}</InputGroupAddon>
      <InputGroupInput type="number" inputMode="decimal" placeholder="0.00" {...props} />
    </InputGroup>
  );
}
