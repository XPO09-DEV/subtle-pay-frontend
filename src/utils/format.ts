const SYMBOLS: Record<string, string> = { USD: "$", INR: "₹" };

export function money(amount: number | string, currency = "USD") {
  const value = Number(amount);
  const shown = Number.isFinite(value) ? value.toFixed(2) : "0.00";
  return (SYMBOLS[currency] ?? currency + " ") + shown;
}
