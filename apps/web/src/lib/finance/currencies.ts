export const currencyOptions = [
  { value: "BDT", label: "Bangladeshi taka", description: "৳ · BDT" },
  { value: "USD", label: "US dollar", description: "$ · USD" },
  { value: "EUR", label: "Euro", description: "€ · EUR" },
  { value: "GBP", label: "British pound", description: "£ · GBP" },
  { value: "INR", label: "Indian rupee", description: "₹ · INR" },
] as const;

export function getCurrencyPrefix(currency: string) {
  try {
    const part = new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
    })
      .formatToParts(0)
      .find((candidate) => candidate.type === "currency");
    return part?.value ?? currency;
  } catch {
    return currency;
  }
}
