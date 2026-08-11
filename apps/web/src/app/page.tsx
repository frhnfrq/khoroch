import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";
import { Badge } from "@khoroch/ui/components/badge";
import { Button } from "@khoroch/ui/components/button";
import { Separator } from "@khoroch/ui/components/separator";
import { cn } from "@khoroch/ui/lib/utils";
import {
  ArrowRightIcon,
  ChartNoAxesCombinedIcon,
  LandmarkIcon,
  PiggyBankIcon,
  ShieldCheckIcon,
  SparklesIcon,
  WalletCardsIcon,
} from "lucide-react";
import Link from "next/link";

import { ModeToggle } from "@/components/mode-toggle";

const features = [
  {
    icon: LandmarkIcon,
    title: "Every account",
    description: "Cash, bank, bKash, savings, and more—one reliable balance.",
    tone: "bg-chart-1/15 text-chart-1",
  },
  {
    icon: ChartNoAxesCombinedIcon,
    title: "Every movement",
    description: "Income, expenses, splits, transfers, fees, and refunds stay connected.",
    tone: "bg-chart-3/15 text-chart-3",
  },
  {
    icon: PiggyBankIcon,
    title: "Every plan",
    description: "Monthly and nested budgets show what is spent and what remains.",
    tone: "bg-chart-5/15 text-chart-5",
  },
] as const;

export default function HomePage() {
  return (
    <main className="min-h-svh overflow-hidden">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="Khoroch home">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <WalletCardsIcon className="size-4" aria-hidden="true" />
          </span>
          <span className="font-semibold tracking-tight">Khoroch</span>
        </Link>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <Show when="signed-out">
            <SignInButton>
              <Button variant="ghost">Sign in</Button>
            </SignInButton>
            <SignUpButton>
              <Button>Get started</Button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <Button nativeButton={false} render={<Link href="/dashboard" />}>
              Open Khoroch
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </Show>
        </div>
      </header>

      <section className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:flex-row lg:items-center lg:py-28">
        <div className="pointer-events-none absolute -top-20 right-0 size-72 rounded-full bg-chart-1/15 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/4 size-64 rounded-full bg-chart-4/10 blur-3xl" />

        <div className="relative flex flex-1 flex-col items-start gap-6">
          <Badge variant="secondary">
            <SparklesIcon data-icon="inline-start" />
            Personal finance without spreadsheet chaos
          </Badge>
          <div className="flex max-w-2xl flex-col gap-4">
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              Know where your money is. And where it went.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              One calm place for account balances, salary, everyday expenses, transfers, and monthly
              budgets.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Show when="signed-out">
              <SignUpButton>
                <Button size="lg">
                  Start tracking
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </SignUpButton>
              <SignInButton>
                <Button size="lg" variant="outline">
                  I have an account
                </Button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <Button size="lg" nativeButton={false} render={<Link href="/dashboard" />}>
                Go to overview
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </Show>
          </div>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheckIcon className="size-4" aria-hidden="true" />
            Private by default. Your financial data is scoped to your account.
          </p>
        </div>

        <div className="relative flex flex-1 flex-col overflow-hidden rounded-3xl border bg-background/80 shadow-2xl shadow-primary/5 backdrop-blur">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">Total balance</p>
              <p className="text-3xl font-semibold tracking-tight">৳128,450</p>
            </div>
            <Badge variant="secondary">August</Badge>
          </div>
          <Separator />
          <div className="grid grid-cols-2">
            <div className="flex flex-col gap-1 border-r p-5">
              <p className="text-xs text-muted-foreground">Income</p>
              <p className="font-semibold text-chart-4">+৳90,000</p>
            </div>
            <div className="flex flex-col gap-1 p-5">
              <p className="text-xs text-muted-foreground">Spent</p>
              <p className="font-semibold text-destructive">−৳42,620</p>
            </div>
          </div>
          <Separator />
          <div className="flex flex-col gap-4 p-5">
            {features.map(({ icon: Icon, title, description, tone }) => (
              <div key={title} className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl",
                    tone,
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
