import { CURRENCIES } from "./currencies";

export function money(amount: number, currency = "USD") {
  const digits = CURRENCIES[currency]?.exponent ?? 2;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(digits)}`;
  }
}