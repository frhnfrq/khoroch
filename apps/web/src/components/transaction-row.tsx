import { Badge } from "@khoroch/ui/components/badge";
import { cn } from "@khoroch/ui/lib/utils";
import {
  ArrowDownLeftIcon,
  ArrowRightLeftIcon,
  ArrowUpRightIcon,
  CircleDollarSignIcon,
  RotateCcwIcon,
} from "lucide-react";

import { FinanceIcon } from "@/components/finance-icon";
import { formatMoney } from "@/lib/finance/format";
import type { TransactionView } from "@/lib/finance/types";

const dateFormatter = new Intl.DateTimeFormat("en-BD", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function TransactionTypeIcon({ transaction }: { transaction: TransactionView }) {
  const categoryIcon = transaction.entries.find((entry) => entry.categoryIcon)?.categoryIcon;
  if (categoryIcon) return <FinanceIcon name={categoryIcon} className="size-4" />;
  if (transaction.type === "transfer") return <ArrowRightLeftIcon className="size-4" />;
  if (transaction.type === "income") return <ArrowDownLeftIcon className="size-4" />;
  if (transaction.type === "refund") return <RotateCcwIcon className="size-4" />;
  if (transaction.type === "expense") return <ArrowUpRightIcon className="size-4" />;
  return <CircleDollarSignIcon className="size-4" />;
}

export function TransactionRow({
  transaction,
  compact = false,
  action,
}: {
  transaction: TransactionView;
  compact?: boolean;
  action?: React.ReactNode;
}) {
  const uniqueCategories = new Set(
    transaction.entries.flatMap((entry) => (entry.categoryName ? [entry.categoryName] : [])),
  );
  const accountNames = [...new Set(transaction.entries.map((entry) => entry.accountName))];
  const amountPrefix =
    transaction.type === "expense"
      ? "−"
      : transaction.type === "income" || transaction.type === "refund"
        ? "+"
        : "";

  return (
    <div className={cn("flex items-center gap-3 py-3", compact && "py-2.5")}>
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-2xl",
          transaction.type === "expense" && "bg-destructive/10 text-destructive",
          transaction.type === "income" && "bg-chart-4/15 text-chart-4",
          transaction.type === "refund" && "bg-chart-5/15 text-chart-5",
          transaction.type === "transfer" && "bg-chart-1/15 text-chart-1",
          transaction.type === "adjustment" && "bg-muted text-muted-foreground",
        )}
      >
        <TransactionTypeIcon transaction={transaction} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{transaction.title}</p>
          {transaction.status === "pending" ? <Badge variant="secondary">Pending</Badge> : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {uniqueCategories.size > 1
            ? `${uniqueCategories.size} splits`
            : ([...uniqueCategories][0] ?? accountNames.join(" → "))}
          {compact ? "" : ` · ${dateFormatter.format(new Date(transaction.occurredAt))}`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="text-right">
          <p
            className={cn(
              "text-sm font-semibold tabular-nums",
              transaction.type === "expense" && "text-destructive",
              (transaction.type === "income" || transaction.type === "refund") && "text-chart-4",
            )}
          >
            {amountPrefix}
            {formatMoney(transaction.amount, transaction.currency)}
          </p>
          {transaction.transferFee > 0 ? (
            <p className="text-[0.65rem] text-muted-foreground">
              {formatMoney(transaction.transferFee, transaction.currency)} fee
            </p>
          ) : null}
        </div>
        {action}
      </div>
    </div>
  );
}
