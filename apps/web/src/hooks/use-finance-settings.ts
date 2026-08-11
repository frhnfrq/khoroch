"use client";

import useSWR from "swr";

import type { FinanceSettings } from "@/lib/finance/types";

export function useFinanceSettings() {
  const result = useSWR<{ settings: FinanceSettings }>("/api/settings");
  return {
    ...result,
    settings: result.data?.settings ?? null,
    defaultCurrency: result.data?.settings.defaultCurrency ?? "BDT",
  };
}
