"use client";

import { Toaster } from "@khoroch/ui/components/sonner";
import { SWRConfig } from "swr";

import { apiFetch } from "@/lib/client-api";
import { ThemeProvider } from "./theme-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SWRConfig
        value={{
          fetcher: apiFetch,
          revalidateOnFocus: true,
          shouldRetryOnError: true,
          errorRetryCount: 3,
          errorRetryInterval: 3_000,
        }}
      >
        {children}
        <Toaster richColors />
      </SWRConfig>
    </ThemeProvider>
  );
}
