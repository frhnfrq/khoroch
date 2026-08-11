import { Button } from "@khoroch/ui/components/button";
import { CloudOffIcon, RotateCcwIcon, WalletCardsIcon } from "lucide-react";
import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-10">
      <div className="flex max-w-sm flex-col items-center gap-5 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-chart-1/15 text-chart-1">
          <CloudOffIcon className="size-5" />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold">You’re offline</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Khoroch is installed and ready. Reconnect to load or change financial data; queued
            offline entries will arrive in the next sync version.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/dashboard" />}>
          <RotateCcwIcon data-icon="inline-start" />
          Try again
        </Button>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <WalletCardsIcon className="size-4" />
          Cached pages never include your account data.
        </p>
      </div>
    </main>
  );
}
