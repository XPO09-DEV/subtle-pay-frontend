import type { HomeData, Me, Payment, Rates, SendResult, Wallet, WithdrawResult } from "../types/api";

const BASE = ((import.meta.env.VITE_SUBTLEPAY_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? "") as string).trim().replace(/\/+$/, "");

type SessionResponse = {
  token: string;
  /** Refresh token is deliberately never returned by the backend to browser JS. */
  expiresIn: number;
  accountId?: string;
  address?: string;
};
type ApiFailure = { message?: string; error?: { message?: string } };

let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;
export const getToken = () => accessToken;
/** Refresh credentials live only in an HttpOnly cookie managed by the backend. */
export const getRefreshToken = () => null;
export const hasSession = () => Boolean(accessToken);
export function saveSession(token: string, _legacyRefreshToken?: string) { accessToken = token; }
export function clearToken() { accessToken = null; }

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${BASE}/auth/refresh`, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({}),
        });
        const data = (await response.json().catch(() => ({}))) as Partial<SessionResponse>;
        if (!response.ok || typeof data.token !== "string") throw new Error("Session expired");
        accessToken = data.token;
        return accessToken;
      } catch {
        clearToken();
        return null;
      }
    })().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

async function request<T>(method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<T> {
  const send = (token: string | null) => {
    const headers: Record<string, string> = { Accept: "application/json", ...extraHeaders };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: "include", cache: "no-store" });
  };
  let response = await send(accessToken);
  const canRefresh = path !== "/auth/login" && path !== "/auth/register" && path !== "/auth/refresh";
  if (response.status === 401 && canRefresh) {
    const nextToken = await refreshAccessToken();
    if (!nextToken) { clearToken(); throw new Error("Your session expired. Please log in again."); }
    response = await send(nextToken);
  }
  const data = await response.json().catch(() => ({})) as ApiFailure & Record<string, unknown>;
  if (!response.ok) throw new Error(data?.error?.message || data?.message || `Request failed (${response.status}).`);
  return data as T;
}

export const api = {
  register: (password: string) => request<SessionResponse>("POST", "/auth/register", { password }),
  login: (accountId: string, password: string) => request<SessionResponse>("POST", "/auth/login", { accountId, password }),
  logout: async () => { try { return await request<{ ok: boolean }>("POST", "/auth/logout"); } finally { clearToken(); } },
  changePassword: (oldPassword: string, newPassword: string) => request<{ ok: boolean }>("POST", "/auth/change-password", { oldPassword, newPassword }),
  getMe: () => request<Me>("GET", "/me"),
  getHome: () => request<HomeData>("GET", "/home"),
  setCurrency: (currency: string) => request<{ currency: string }>("PUT", "/me/currency", { currency }),
  getWallet: () => request<Wallet>("GET", "/wallet"),
  setAlias: (alias: string) => request<{ alias: string }>("POST", "/alias", { alias }),
  resolveAlias: (name: string) => request<{ alias: string; address: string }>("GET", `/alias/${encodeURIComponent(name)}`),
  getRates: (currency: string) => request<Rates>("GET", `/rates?${new URLSearchParams({ currency })}`),
  getCurrencies: () => request<{ currencies: Array<{ code: string; name: string; exponent: number }> }>("GET", "/rates/currencies"),
  getTokenPrice: (currency: string, amount = "1") => request<{ asset: string; currency: string; tokenUsd: number; price: string; amount: string; value: string; updatedAt: string }>("GET", `/rates/token?${new URLSearchParams({ currency, amount })}`),
  getAssets: () => request<{ assets: Array<Record<string, unknown>> }>("GET", "/assets"),
  send: (to: string, amount: number, amountCurrency: string, note?: string) => request<SendResult>("POST", "/payments/send", { to, amount, amountCurrency, note, asset: "MON" }, { "idempotency-key": crypto.randomUUID() }),
  getPayments: () => request<Payment[]>("GET", "/payments?limit=50"),
  withdraw: (amount: number, currency: string) => request<WithdrawResult>("POST", "/withdraw", { amount, currency }),
};
