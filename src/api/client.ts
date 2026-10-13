import type { HomeData, Me, Payment, Rates, SendResult, Wallet, WithdrawResult } from "../types/api";

const CONFIGURED_BASE = (
  import.meta.env.VITE_SUBTLEPAY_API_BASE_URL ??
  import.meta.env.VITE_API_URL ??
  ""
).trim().replace(/\/+$/, "");

type SessionResponse = {
  token: string;
  /** Compatibility only: the backend never returns refresh tokens to JavaScript. */
  refreshToken?: string;
  expiresIn: number;
  accountId?: string;
  address?: string;
};

type PaymentPage = { items: Payment[]; limit: number; offset: number; total: number; nextOffset: number | null };

type ApiFailure = {
  message?: string;
  error?: { message?: string };
};

// Access tokens are memory-only. Refresh tokens belong in the backend's HttpOnly cookie.
let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;

function apiBase(): string {
  if (typeof window === "undefined") return CONFIGURED_BASE;
  const local = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  // Ignore machine-local URLs in forwarded/tunnel browsers; use same-origin Vite proxy instead.
  if (!local) return window.location.origin;
  return CONFIGURED_BASE || window.location.origin;
}

export const getToken = () => accessToken;
// Kept only for compatibility with legacy imports; the refresh token is never exposed to JS.
export const getRefreshToken = () => null;
export const hasSession = () => Boolean(accessToken);

export function saveSession(token: string, _refreshToken?: string) {
  accessToken = token;
}

export function clearToken() {
  accessToken = null;
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${apiBase()}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => ({})) as Partial<SessionResponse>;
      if (!response.ok || typeof data.token !== "string") {
        throw new Error("The session has expired.");
      }
      saveSession(data.token);
      return data.token;
    } catch {
      clearToken();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const send = (token: string | null) => {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...extraHeaders,
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${apiBase()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "include",
      cache: "no-store",
    });
  };

  let response = await send(accessToken);
  const canRefresh = path !== "/auth/login" && path !== "/auth/register" && path !== "/auth/refresh";

  if (response.status === 401 && canRefresh) {
    const nextToken = await refreshAccessToken();
    if (!nextToken) {
      clearToken();
      throw new Error("Your session expired. Please log in again.");
    }
    response = await send(nextToken);
  }

  const data = await response.json().catch(() => ({})) as ApiFailure & Record<string, unknown>;
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || `Request failed (${response.status}).`);
  }
  return data as T;
}

export const api = {
  register: (password: string) =>
    request<SessionResponse>("POST", "/auth/register", { password }),
  login: (accountId: string, password: string) =>
    request<SessionResponse>("POST", "/auth/login", { accountId, password }),
  logout: () => request<{ ok: boolean }>("POST", "/auth/logout"),
  changePassword: (oldPassword: string, newPassword: string) =>
    request<{ ok: boolean }>("POST", "/auth/change-password", { oldPassword, newPassword }),
  getMe: () => request<Me>("GET", "/me"),
  getHome: () => request<HomeData>("GET", "/home"),
  setCurrency: (currency: string) =>
    request<{ currency: string }>("PUT", "/me/currency", { currency }),
  getWallet: () => request<Wallet>("GET", "/wallet"),
  setAlias: (alias: string) =>
    request<{ alias: string }>("POST", "/alias", { alias }),
  resolveAlias: (name: string) =>
    request<{ alias: string; address: string }>("GET", `/alias/${encodeURIComponent(name)}`),
  getRates: (currency: string) =>
    request<Rates>("GET", `/rates?${new URLSearchParams({ currency })}`),
  getCurrencies: () =>
    request<{ currencies: Array<{ code: string; name: string; exponent: number }> }>("GET", "/rates/currencies"),
  getTokenPrice: (currency: string, amount = "1") =>
    request<{ asset: string; currency: string; tokenUsd: number; price: string; amount: string; value: string; updatedAt: string }>(
      "GET",
      `/rates/token?${new URLSearchParams({ currency, amount })}`,
    ),
  getAssets: () => request<{ assets: Array<Record<string, unknown>> }>("GET", "/assets"),
  send: (to: string, amount: number, amountCurrency: string, note?: string) =>
    request<SendResult>(
      "POST",
      "/payments/send",
      { to, amount, amountCurrency, note },
      { "idempotency-key": crypto.randomUUID() },
    ),
  getPayments: async () => (await request<PaymentPage>("GET", "/payments?limit=50&offset=0")).items,
  withdraw: (amount: number, currency: string) =>
    request<WithdrawResult>("POST", "/withdraw", { amount, currency }),
};
