export const currencyFormatter = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 2,
});

export function formatMoney(value: number, currency = "BDT") {
  if (currency === "BDT") return currencyFormatter.format(value);
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCompactMoney(value: number, currency = "BDT") {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function getTransactionDisplayAmount(
  type: "expense" | "income" | "transfer" | "adjustment" | "refund",
  entries: Array<{ amount: number }>,
) {
  const positive = entries.reduce((total, entry) => total + Math.max(entry.amount, 0), 0);
  const negative = entries.reduce((total, entry) => total + Math.min(entry.amount, 0), 0);

  if (type === "transfer") return positive;
  if (type === "expense") return Math.abs(negative);
  if (type === "income" || type === "refund") return positive;
  return Math.max(positive, Math.abs(negative));
}

export function getTransferFee(entries: Array<{ amount: number }>) {
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
  return total < 0 ? Math.abs(total) : 0;
}
