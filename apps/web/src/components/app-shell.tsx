"use client";

import { UserButton } from "@clerk/nextjs";
import { Badge } from "@khoroch/ui/components/badge";
import { Button } from "@khoroch/ui/components/button";
import { Separator } from "@khoroch/ui/components/separator";
import { cn } from "@khoroch/ui/lib/utils";
import {
  ChartNoAxesCombinedIcon,
  ListFilterIcon,
  LandmarkIcon,
  PiggyBankIcon,
  Settings2Icon,
  WalletCardsIcon,
  type LucideIcon,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { mutate } from "swr";

import { apiFetch } from "@/lib/client-api";
import { AddTransactionDrawer } from "./add-transaction-drawer";
import { ModeToggle } from "./mode-toggle";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: ChartNoAxesCombinedIcon },
  { href: "/transactions", label: "Activity", icon: ListFilterIcon },
  { href: "/budgets", label: "Budgets", icon: PiggyBankIcon },
  { href: "/accounts", label: "Accounts", icon: LandmarkIcon },
] as const satisfies ReadonlyArray<{ href: Route; label: string; icon: LucideIcon }>;

function BrandMark() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2" aria-label="Khoroch overview">
      <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <WalletCardsIcon className="size-4" aria-hidden="true" />
      </span>
      <span className="text-sm font-semibold tracking-tight md:hidden">Khoroch</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    void apiFetch<{ ready: boolean }>("/api/bootstrap", { method: "POST" })
      .then(() => mutate("/api/categories"))
      .catch(() => undefined);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const currentPage = navigation.find((item) => pathname.startsWith(item.href));
  const currentPageLabel = pathname.startsWith("/settings") ? "Settings" : currentPage?.label;

  return (
    <div className="min-h-svh bg-background">
      <aside className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:inset-y-0 md:left-0 md:right-auto md:flex md:w-20 md:flex-col md:border-r md:border-t-0">
        <div className="hidden h-14 items-center justify-center md:flex">
          <BrandMark />
        </div>
        <Separator className="hidden md:block" />
        <nav className="grid h-16 grid-cols-5 items-center px-2 pb-[max(env(safe-area-inset-bottom),0px)] md:flex md:h-auto md:flex-1 md:flex-col md:justify-start md:gap-2 md:px-2 md:py-4">
          {navigation.slice(0, 2).map((item) => (
            <NavigationItem key={item.href} item={item} active={pathname.startsWith(item.href)} />
          ))}
          <div className="flex items-center justify-center md:order-last md:mt-auto">
            <AddTransactionDrawer />
          </div>
          {navigation.slice(2).map((item) => (
            <NavigationItem key={item.href} item={item} active={pathname.startsWith(item.href)} />
          ))}
        </nav>
      </aside>

      <div className="md:pl-20">
        <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="md:hidden">
                <BrandMark />
              </div>
              <div className="hidden flex-col md:flex">
                <p className="text-sm font-semibold">{currentPageLabel ?? "Khoroch"}</p>
                <p className="text-xs text-muted-foreground">Your money, clearly tracked</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isOnline ? <Badge variant="secondary">Offline</Badge> : null}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Settings"
                nativeButton={false}
                render={<Link href="/settings" />}
              >
                <Settings2Icon />
              </Button>
              <ModeToggle />
              <UserButton />
            </div>
          </div>
        </header>

        <main className="mx-auto min-h-[calc(100svh-3.5rem)] max-w-6xl px-4 py-5 pb-24 sm:px-6 md:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavigationItem({ item, active }: { item: (typeof navigation)[number]; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[0.65rem] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:w-full",
        active && "bg-muted text-foreground",
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
