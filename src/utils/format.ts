<<<<<<< HEAD
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
=======
const SYMBOLS: Record<string, string> = { USD: "$", INR: "₹" };

export function money(amount: number | string, currency = "USD") {
  const value = Number(amount);
  const shown = Number.isFinite(value) ? value.toFixed(2) : "0.00";
  return (SYMBOLS[currency] ?? currency + " ") + shown;
}
>>>>>>> a26f18097bfee4d553da3f1a17dee27e2f322425
