const SYMBOLS: Record<string, string> = { USD: "$", INR: "₹" };

export function money(amount: number, currency = "USD") {
  return (SYMBOLS[currency] ?? currency + " ") + amount.toFixed(2);
}