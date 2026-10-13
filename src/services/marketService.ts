import { getBackendApiBaseUrl } from "./walletService";

export type MarketPeriod = "24h" | "1w" | "1m" | "3m";
export type PrimaryCoinId = "tether" | "usd-coin" | "monad";
export interface MarketQuote {
  key: PrimaryCoinId;
  id: string;
  name: string;
  symbol: string;
  image: string | null;
  price: number;
  change24h: number | null;
  marketCap: number | null;
  volume24h: number | null;
  updatedAt: string;
}
export interface MarketPoint { time: number; price: number; }
export interface MarketHistory { points: MarketPoint[]; updatedAt: string; }

function apiUrl(path: string): string {
  const base = getBackendApiBaseUrl().replace(/\/+$/, "");
  return base + (path.startsWith("/") ? path : "/" + path);
}
async function json(path: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), { headers: { accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(12_000) });
  } catch {
    throw new Error("Market data is unreachable. Check the backend and CoinStats API configuration.");
  }
  if (!response.ok) {
    let message = "Market data is temporarily unavailable.";
    try {
      const body = await response.json() as { error?: { message?: string }; message?: string };
      message = body.error?.message ?? body.message ?? message;
    } catch { /* the provider may return a non-JSON error */ }
    throw new Error(message);
  }
  return response.json();
}
function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function rowsFrom(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 5) return [];
  if (Array.isArray(value)) {
    const rows = value.map(record).filter((item): item is Record<string, unknown> => item !== null);
    if (rows.length) return rows;
  }
  const obj = record(value);
  if (!obj) return [];
  for (const key of ["coins", "result", "data", "items", "markets", "history", "charts", "chart", "prices", "points"]) {
    const nested = obj[key];
    if (Array.isArray(nested)) {
      const rows = nested.map(record).filter((item): item is Record<string, unknown> => item !== null);
      if (rows.length) return rows;
      if (nested.length) return rowsFrom(nested, depth + 1);
    }
    const found = rowsFrom(nested, depth + 1);
    if (found.length) return found;
  }
  return [];
}
function numberAt(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = obj[key];
    const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
    if (Number.isFinite(n)) return n;
  }
  return null;
}
function textAt(obj: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const key of keys) if (typeof obj[key] === "string" && (obj[key] as string).trim()) return (obj[key] as string).trim();
  return fallback;
}
function coinMatch(row: Record<string, unknown>, requested: PrimaryCoinId): boolean {
  const id = textAt(row, ["id", "coinId", "slug"]).toLowerCase();
  const symbol = textAt(row, ["symbol", "ticker"]).toLowerCase();
  const name = textAt(row, ["name", "coinName"]).toLowerCase();
  if (requested === "tether") return symbol === "usdt" || id === "tether" || name === "tether";
  if (requested === "usd-coin") return symbol === "usdc" || id === "usd-coin" || name === "usd coin" || name === "usd coin (usdc)";
  return (symbol === "mon" || id.includes("monad") || name.includes("monad")) && !name.includes("monero");
}
function makeQuote(row: Record<string, unknown>, requested: PrimaryCoinId): MarketQuote | null {
  const price = numberAt(row, ["price", "priceUsd", "priceUSD", "currentPrice", "current_price"]);
  if (price === null || price < 0) return null;
  const canonical = requested === "tether" ? { id: "tether", name: "Tether", symbol: "USDT" }
    : requested === "usd-coin" ? { id: "usd-coin", name: "USD Coin", symbol: "USDC" }
    : { id: "monad", name: "Monad", symbol: "MON" };
  return {
    key: requested,
    ...canonical,
    id: textAt(row, ["id", "coinId", "slug"], canonical.id),
    name: textAt(row, ["name", "coinName"], canonical.name),
    symbol: textAt(row, ["symbol", "ticker"], canonical.symbol).toUpperCase(),
    image: textAt(row, ["icon", "image", "thumbnail", "logo", "imageUrl"], "") || null,
    price,
    change24h: numberAt(row, ["priceChange1d", "priceChange24h", "price_change_percentage_24h", "change24h", "change"]),
    marketCap: numberAt(row, ["marketCap", "market_cap", "marketCapUsd"]),
    volume24h: numberAt(row, ["volume", "volume24h", "totalVolume", "total_volume"]),
    updatedAt: new Date().toISOString(),
  };
}
function historyPoints(payload: unknown): MarketPoint[] {
  const out: MarketPoint[] = [];
  const parsePoint = (row: unknown): MarketPoint | null => {
    if (Array.isArray(row) && row.length >= 2) {
      let time = Number(row[0]);
      const price = Number(row[1]);
      if (!Number.isFinite(time) || !Number.isFinite(price) || price <= 0) return null;
      if (time < 1_000_000_000_000) time *= 1000;
      return { time, price };
    }
    const obj = record(row);
    if (!obj) return null;
    const rawTime = obj.timestamp ?? obj.time ?? obj.date ?? obj.t ?? obj.x;
    const timeValue = typeof rawTime === "string" && !/^\d+(\.\d+)?$/.test(rawTime) ? Date.parse(rawTime) : Number(rawTime);
    const price = numberAt(obj, ["price", "value", "close", "usd", "y", "v"]);
    if (!Number.isFinite(timeValue) || price === null || price <= 0) return null;
    const time = timeValue < 1_000_000_000_000 ? timeValue * 1000 : timeValue;
    return { time, price };
  };
  const walk = (value: unknown, depth = 0): void => {
    if (depth > 7 || value == null) return;
    if (Array.isArray(value)) {
      const point = parsePoint(value);
      if (point) { out.push(point); return; }
      for (const item of value) walk(item, depth + 1);
      return;
    }
    const point = parsePoint(value);
    if (point) { out.push(point); return; }
    const obj = record(value);
    if (!obj) return;
    for (const [key, nested] of Object.entries(obj)) {
      if (["chart", "charts", "history", "prices", "result", "data", "items", "points", "priceHistory"].includes(key)) {
        walk(nested, depth + 1);
      }
    }
  };
  walk(payload);
  return out.sort((a, b) => a.time - b.time)
    .filter((point, index, rows) => index === 0 || point.time > rows[index - 1].time);
}
const COINS: PrimaryCoinId[] = ["tether", "usd-coin", "monad"];

export async function getPrimaryMarketQuotes(): Promise<MarketQuote[]> {
  const list = await json("/market/coins?limit=100&skip=0&currency=USD");
  let rows = rowsFrom(list);
  const found: MarketQuote[] = [];
  for (const id of COINS) {
    let row = rows.find((item) => coinMatch(item, id));
    if (!row && id === "monad") {
      try {
        const search = await json("/market/search?q=monad&currency=USD");
        row = rowsFrom(search).find((item) => coinMatch(item, id));
      } catch { /* keep MON unavailable rather than inventing a market quote */ }
    }
    if (row) {
      const quote = makeQuote(row, id);
      if (quote) found.push(quote);
    }
  }
  return found;
}

export async function getPrimaryMarketHistory(coinId: string, period: MarketPeriod): Promise<MarketHistory> {
  const payload = await json("/market/coins/" + encodeURIComponent(coinId) + "/charts?period=" + period + "&currency=USD");
  const points = historyPoints(payload);
  if (!points.length) throw new Error("No historical prices are available for this coin and timeframe.");
  return { points, updatedAt: new Date().toISOString() };
}
