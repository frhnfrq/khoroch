"use client";

import { Badge } from "@khoroch/ui/components/badge";
import { Button } from "@khoroch/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@khoroch/ui/components/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@khoroch/ui/components/drawer";
import { Separator } from "@khoroch/ui/components/separator";
import { EyeIcon, PencilIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { AddTransactionDrawer } from "@/components/add-transaction-drawer";
import { DeleteTransactionButton } from "@/components/delete-transaction-button";
import { formatMoney } from "@/lib/finance/format";
import type { TransactionEntryView, TransactionView } from "@/lib/finance/types";

const dateTimeFormatter = new Intl.DateTimeFormat("en-BD", {
  dateStyle: "medium",
  timeStyle: "short",
});

const typeLabels: Record<TransactionView["type"], string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
  adjustment: "Adjustment",
  refund: "Refund",
};

const statusLabels: Record<TransactionView["status"], string> = {
  pending: "Pending",
  cleared: "Cleared",
  void: "Void",
};

const accountTypeLabels: Record<TransactionEntryView["accountType"], string> = {
  cash: "Cash",
  bank: "Bank",
  mobile_wallet: "Mobile wallet",
  savings: "Savings",
  credit_card: "Credit card",
  other: "Other",
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[68%] break-words text-right font-medium">{value}</dd>
    </div>
  );
}

function entryDirection(transaction: TransactionView, entry: TransactionEntryView) {
  if (transaction.type === "transfer") return entry.amount < 0 ? "Source" : "Destination";
  if (entry.amount < 0) return "Money out";
  return "Money in";
}

function EntryCard({
  transaction,
  entry,
  index,
}: {
  transaction: TransactionView;
  entry: TransactionEntryView;
  index: number;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{entry.accountName}</CardTitle>
        <CardDescription>
          {entryDirection(transaction, entry)} · {accountTypeLabels[entry.accountType]}
        </CardDescription>
        <CardAction className="text-sm font-semibold tabular-nums">
          {formatMoney(entry.amount, entry.accountCurrency)}
        </CardAction>
      </CardHeader>
      <CardContent>
        <dl>
          <DetailRow label="Entry" value={`#${index + 1}`} />
          <DetailRow label="Category" value={entry.categoryName ?? "Uncategorized"} />
          <DetailRow label="Budget item" value={entry.budgetItemName ?? "Not linked"} />
          <DetailRow label="Funding source" value={entry.fundingBucketName ?? "Not linked"} />
          <DetailRow
            label="Account balance"
            value={entry.affectsBalance ? "Included" : "Historical — not included"}
          />
          {entry.memo ? <DetailRow label="Entry memo" value={entry.memo} /> : null}
        </dl>
      </CardContent>
    </Card>
  );
}

export function TransactionDetailsDrawer({
  transaction,
  trigger,
}: {
  transaction: TransactionView;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const amountPrefix =
    transaction.type === "expense"
      ? "−"
      : transaction.type === "income" || transaction.type === "refund"
        ? "+"
        : "";

  return (
    <Drawer open={open} onOpenChange={setOpen} showSwipeHandle>
      <DrawerTrigger
        render={
          trigger ? (
            <button
              type="button"
              className="w-full rounded-2xl text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={`View details for ${transaction.title}`}
            />
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`View details for ${transaction.title}`}
            />
          )
        }
      >
        {trigger ?? <EyeIcon />}
      </DrawerTrigger>
      <DrawerContent className="mx-auto max-w-xl">
        <DrawerHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DrawerTitle>{transaction.title}</DrawerTitle>
            <Badge variant="outline">{typeLabels[transaction.type]}</Badge>
            <Badge variant={transaction.status === "void" ? "destructive" : "secondary"}>
              {statusLabels[transaction.status]}
            </Badge>
            {transaction.isHistorical ? <Badge variant="secondary">Historical</Badge> : null}
          </div>
          <DrawerDescription>
            Account, category, budget, funding, notes, status, and timestamps for this activity.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {amountPrefix}
            {formatMoney(transaction.amount, transaction.currency)}
          </p>
          {transaction.transferFee > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Transfer fee: {formatMoney(transaction.transferFee, transaction.currency)}
            </p>
          ) : null}

          <Separator className="my-5" />

          <dl className="text-xs">
            <DetailRow
              label="Occurred"
              value={dateTimeFormatter.format(new Date(transaction.occurredAt))}
            />
            <DetailRow label="Payee" value={transaction.payee ?? "Not entered"} />
            <DetailRow label="Status" value={statusLabels[transaction.status]} />
            <DetailRow
              label="Balance handling"
              value={transaction.isHistorical ? "Excluded from balances" : "Included in balances"}
            />
            <DetailRow
              label="Created"
              value={dateTimeFormatter.format(new Date(transaction.createdAt))}
            />
            <DetailRow
              label="Last updated"
              value={dateTimeFormatter.format(new Date(transaction.updatedAt))}
            />
            {transaction.parentTransactionId ? (
              <DetailRow label="Related activity ID" value={transaction.parentTransactionId} />
            ) : null}
          </dl>

          {transaction.note ? (
            <>
              <Separator className="my-5" />
              <section className="flex flex-col gap-1.5">
                <h3 className="text-xs font-medium">Note</h3>
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                  {transaction.note}
                </p>
              </section>
            </>
          ) : null}

          <Separator className="my-5" />

          <section className="flex flex-col gap-3">
            <div>
              <h3 className="text-xs font-medium">Account entries</h3>
              <p className="text-xs text-muted-foreground">
                {transaction.entries.length}{" "}
                {transaction.entries.length === 1 ? "entry" : "entries"}
              </p>
            </div>
            {transaction.entries.map((entry, index) => (
              <EntryCard key={entry.id} transaction={transaction} entry={entry} index={index} />
            ))}
          </section>
        </div>
        <DrawerFooter className="flex-row border-t bg-popover pt-4">
          <AddTransactionDrawer
            transaction={transaction}
            trigger={
              <Button type="button" variant="outline" className="w-full">
                <PencilIcon data-icon="inline-start" />
                Edit
              </Button>
            }
          />
          <DeleteTransactionButton
            transactionId={transaction.id}
            transactionTitle={transaction.title}
            onDeleted={() => setOpen(false)}
          />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
