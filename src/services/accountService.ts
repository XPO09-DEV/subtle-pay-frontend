import { getBackendApiBaseUrl } from "./walletService";

export interface AccountProfile {
  accountId: string;
  alias: string | null;
  displayName: string | null;
  currency: string;
  accountCreatedAt: number;
  lastLoginAt: number | null;
  walletAddress: string | null;
  walletCreatedAt: number | null;
  region: string | null;
  regionConsentAt: number | null;
  country: string | null;
}

export interface AccountSession {
  profile: AccountProfile;
  addressCreatedOnRegister?: string;
}

interface AuthReply {
  accountId?: string;
  token?: string;
  expiresIn?: number;
  address?: string;
}

interface ProfileUpdate {
  displayName?: string | null;
  region?: string | null;
  shareRegion?: boolean;
  country?: string | null;
}

let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;

function apiUrl(path: string): string {
  const base = getBackendApiBaseUrl().replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  let body: unknown = null;
  try { body = await response.json(); } catch { /* empty/non-JSON response */ }
  if (!response.ok) {
    const root = body && typeof body === "object" ? body as Record<string, unknown> : {};
    const error = root.error && typeof root.error === "object" ? root.error as Record<string, unknown> : {};
    const message = typeof error.message === "string" ? error.message
      : typeof root.message === "string" ? root.message
      : `Subtle Pay API request failed (HTTP ${response.status}).`;
    throw new ApiError(message, response.status);
  }
  return body as T;
}

async function rawRequest<T>(path: string, init: RequestInit = {}, withAccessToken = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  headers.set("accept", "application/json");
  if (withAccessToken && accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  let response: Response;
  try {
    response = await fetch(apiUrl(path), { ...init, headers, credentials: "include", cache: "no-store" });
  } catch {
    throw new Error("Could not reach the Subtle Pay account service. Start the backend or check VITE_SUBTLEPAY_API_BASE_URL.");
  }
  return parseResponse<T>(response);
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const result = await rawRequest<AuthReply>("/auth/refresh", {
        method: "POST", body: JSON.stringify({}),
      }, false);
      accessToken = typeof result.token === "string" ? result.token : null;
      return accessToken;
    } catch {
      accessToken = null;
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function authenticatedRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, init, true);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || path === "/auth/refresh") throw error;
    const nextToken = await refreshAccessToken();
    if (!nextToken) {
      accessToken = null;
      throw error;
    }
    return rawRequest<T>(path, init, true);
  }
}

export function hasAccountSession(): boolean { return Boolean(accessToken); }

export async function registerAccount(password: string): Promise<{ accountId: string; walletAddress: string }> {
  const result = await rawRequest<AuthReply>("/auth/register", { method: "POST", body: JSON.stringify({ password }) }, false);
  if (!result.token || !result.accountId || !result.address) {
    throw new Error("Registration succeeded without the expected account and wallet details.");
  }
  accessToken = result.token;
  return { accountId: result.accountId, walletAddress: result.address };
}

export async function switchSavedAccount(accountId: string): Promise<boolean> {
  try {
    const result = await rawRequest<AuthReply>("/auth/switch-saved", {
      method: "POST", body: JSON.stringify({ accountId: accountId.trim().toUpperCase() }),
    }, false);
    if (!result.token) throw new Error("Saved-session response did not include an access token.");
    accessToken = result.token;
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return false;
    throw error;
  }
}

export async function loginAccount(accountId: string, password: string): Promise<void> {
  const result = await rawRequest<AuthReply>("/auth/login", {
    method: "POST", body: JSON.stringify({ accountId: accountId.trim(), password }),
  }, false);
  if (!result.token) throw new Error("Login response did not include an access token.");
  accessToken = result.token;
}

export async function getAccountProfile(): Promise<AccountProfile> { return authenticatedRequest<AccountProfile>("/me"); }

export async function updateAccountProfile(input: ProfileUpdate): Promise<Pick<AccountProfile, "displayName" | "alias" | "region" | "regionConsentAt" | "country">> {
  return authenticatedRequest("/me/profile", { method: "PUT", body: JSON.stringify(input) });
}

export async function logoutAccount(): Promise<void> {
  try {
    if (accessToken) await authenticatedRequest<{ ok: boolean }>("/auth/logout", { method: "POST" });
  } finally {
    accessToken = null;
    // Refresh tokens remain in an HttpOnly cookie controlled by the backend.
  }
}

export async function restoreAccountSession(): Promise<AccountProfile | null> {
  const nextToken = await refreshAccessToken();
  if (!nextToken) return null;
  try { return await getAccountProfile(); }
  catch { accessToken = null; return null; }
}

export interface AccountHome {
  accountId: string;
  alias: string | null;
  displayName: string | null;
  region: string | null;
  regionConsentAt: number | null;
  currency: string;
  address: string;
  balanceToken: string;
  balanceUsd: string;
  balanceLocal: string;
  asset: string;
  chainId: number;
  rates: { tokenUsd: number; usdLocal: number; currency: string; updatedAt: string };
}

export interface PaymentRecord {
  id: string;
  direction: "in" | "out";
  counterparty: string;
  counterpartyAddress?: string | null;
  counterpartyAlias?: string | null;
  counterpartyIsMerchant?: boolean;
  counterpartyMerchantName?: string | null;
  usdValue: string;
  localValue: string;
  displayCurrency: string;
  status: "pending" | "confirmed" | "failed" | "submitted" | string;
  txHash: string | null;
  note?: string | null;
  confirmedAt?: number | null;
  updatedAt?: number;
  createdAt: string;
}

export interface SendPaymentInput {
  to: string;
  amount: string;
  amountCurrency: string;
  note?: string;
  asset: "MON";
  authorizationToken: string;
}

export interface SendPaymentResult {
  txId: string;
  status: "pending" | "confirmed" | "failed" | "submitted" | string;
  tokenAmount: string;
  usdValue: string;
  txHash: string;
}

export async function getAccountHome(forceRefresh = false): Promise<AccountHome> {
  return authenticatedRequest<AccountHome>(`/home${forceRefresh ? "?refresh=true" : ""}`);
}

export async function submitAccountPayment(input: SendPaymentInput): Promise<SendPaymentResult> {
  const idempotencyKey = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `sp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return authenticatedRequest<SendPaymentResult>("/payments/send", {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: JSON.stringify(input),
  });
}

export async function getPaymentHistory(options: {
  limit?: number; before?: number; beforeId?: string; q?: string;
  status?: "pending" | "submitted" | "confirmed" | "failed";
  direction?: "in" | "out";
  from?: number; to?: number;
} = {}): Promise<PaymentRecord[]> {
  const query = new URLSearchParams();
  if (options.limit !== undefined) query.set("limit", String(Math.max(1, Math.min(100, Math.trunc(options.limit)))));
  if (options.before !== undefined) query.set("before", String(options.before));
  if (options.beforeId) query.set("beforeId", options.beforeId);
  if (options.q?.trim()) query.set("q", options.q.trim());
  if (options.status) query.set("status", options.status);
  if (options.direction) query.set("direction", options.direction);
  if (options.from !== undefined) query.set("from", String(options.from));
  if (options.to !== undefined) query.set("to", String(options.to));
  return authenticatedRequest<PaymentRecord[]>(`/payments${query.size ? `?${query.toString()}` : ""}`);
}

export interface BackendContact {
  name: string;
  accountId: string | null;
  address: string | null;
  alias?: string | null;
  createdAt: number;
}

export async function getContacts(): Promise<BackendContact[]> { return authenticatedRequest<BackendContact[]>("/contacts"); }

export async function saveContact(input: { name: string; recipient: string }): Promise<{ name: string; accountId: string | null; address: string | null }> {
  const recipient = input.recipient.trim();
  const body: { name: string; accountId?: string; address?: string; alias?: string } = { name: input.name };
  if (/^0x[a-fA-F0-9]{40}$/.test(recipient)) body.address = recipient;
  else if (/^[A-Z0-9]{20,40}$/i.test(recipient)) body.accountId = recipient;
  else body.alias = recipient.replace(/^@/, "");
  return authenticatedRequest<{ name: string; accountId: string | null; address: string | null }>("/contacts", { method: "POST", body: JSON.stringify(body) });
}

export async function deleteContact(name: string): Promise<void> {
  await authenticatedRequest(`/contacts/${encodeURIComponent(name)}`, { method: "DELETE" });
}

export interface SignedPayQr { payload: string; chainId: 10143; address: string; alias: string | null; amount: string | null; currency: "USD" | "INR" | null }
export interface VerifiedPayQr { valid: true; to: string; address: string; chainId: 10143; amount: string | null; currency: "USD" | "INR" | null }

export async function getSignedPayQr(amount?: string, currency: "USD" | "INR" = "USD"): Promise<SignedPayQr> {
  const query = amount ? `?amount=${encodeURIComponent(amount)}&currency=${currency}` : "";
  return authenticatedRequest<SignedPayQr>(`/qr/pay${query}`);
}

export async function verifyPayQr(payload: string): Promise<VerifiedPayQr> {
  return authenticatedRequest<VerifiedPayQr>("/qr/verify", { method: "POST", body: JSON.stringify({ payload }) });
}

export async function updateAccountCurrency(currency: string, currentPassword: string): Promise<{ currency: string }> {
  return authenticatedRequest<{ currency: string }>("/me/currency", { method: "PUT", body: JSON.stringify({ currency, currentPassword }) });
}

export interface SupportedCountry { code: string; name: string }
export async function getSupportedCountries(): Promise<SupportedCountry[]> {
  const result = await rawRequest<{ countries: SupportedCountry[] }>("/meta/countries", {}, false);
  return result.countries;
}

export async function updateAccountAlias(alias: string, currentPassword: string): Promise<{ alias: string; previousAlias: string | null }> {
  return authenticatedRequest("/me/alias", { method: "PUT", body: JSON.stringify({ alias, currentPassword }) });
}

export async function getSupportedCurrencies(): Promise<string[]> {
  const result = await rawRequest<{ currencies: Array<{ code: string }> }>("/rates/currencies", {}, false);
  return result.currencies.map((currency) => currency.code.toUpperCase());
}

export async function getAccountRates(currency: string = "USD"): Promise<{ tokenUsd: number; usdLocal: number; currency: string; updatedAt: string }> {
  return rawRequest<{ tokenUsd: number; usdLocal: number; currency: string; updatedAt: string }>(`/rates?currency=${currency}`, {}, false);
}
export interface ActiveAccountSession {
  sessionId: string; createdAt: number; lastSeenAt: number; expiresAt: number;
  ip: string | null; userAgent: string | null; current: boolean;
}
export async function getAccountSessions(): Promise<ActiveAccountSession[]> {
  const response = await authenticatedRequest<{ sessions: ActiveAccountSession[] }>("/me/sessions");
  return response.sessions;
}
export interface LoginHistoryEvent {
  id: string; success: boolean; reason: string; ip: string | null; userAgent: string | null;
  requestId: string | null; eventAt: number;
}
export async function getAccountLoginHistory(limit = 20): Promise<LoginHistoryEvent[]> {
  const response = await authenticatedRequest<{ events: LoginHistoryEvent[] }>(
    "/me/login-events?limit=" + String(Math.max(1, Math.min(50, Math.trunc(limit))))
  );
  return response.events;
}

export async function revokeAccountSession(sessionId: string): Promise<void> {
  await authenticatedRequest("/me/sessions/" + encodeURIComponent(sessionId), { method: "DELETE" });
}
export async function getMpinStatus(): Promise<{ enabled: boolean }> {
  return authenticatedRequest("/auth/mpin/status");
}
export async function setAccountMpin(currentPassword: string, pin: string): Promise<{ enabled: boolean }> {
  return authenticatedRequest("/auth/mpin", { method: "PUT", body: JSON.stringify({ currentPassword, pin }) });
}
export async function removeAccountMpin(currentPassword: string): Promise<{ enabled: boolean }> {
  return authenticatedRequest("/auth/mpin", { method: "DELETE", body: JSON.stringify({ currentPassword }) });
}
export type PaymentAuthorizationIntent = {
  to: string;
  amount: string | number;
  amountCurrency: string;
  note?: string;
  asset?: "MON";
};
export async function authorizePayment(
  method: "password" | "mpin",
  secret: string,
  intent?: PaymentAuthorizationIntent
): Promise<{ authorizationToken: string; expiresIn: number }> {
  return authenticatedRequest("/auth/payment-authorization", { method: "POST", body: JSON.stringify({ method, secret, ...(intent ? { intent } : {}) }) });
}
export async function changeAccountPassword(oldPassword: string, newPassword: string): Promise<{ ok: boolean }> {
  return authenticatedRequest("/auth/change-password", { method: "POST", body: JSON.stringify({ oldPassword, newPassword }) });
}
export async function deleteAccount(currentPassword: string): Promise<void> {
  await authenticatedRequest("/me/delete", { method: "POST", body: JSON.stringify({ currentPassword, confirmation: "DELETE" }) });
  accessToken = null;
}

export interface MerchantProfile {
  userId: string; publicName: string; category: string; status: "unverified" | "approved" | "suspended";
  createdAt: number; updatedAt: number; verifiedAt: number | null;
}
export interface MerchantAutopayApplication {
  id: string; reason: string; status: "pending" | "approved" | "rejected";
  createdAt: number; reviewedAt: number | null; reviewNote: string | null;
}
export async function getMerchantProfile(): Promise<{ enabled: boolean; profile: MerchantProfile | null; verifiedBadge: boolean }> {
  return authenticatedRequest("/merchant/profile");
}
export async function enableMerchantProfile(input: { publicName?: string; category?: string } = {}) {
  return authenticatedRequest<{ enabled: boolean; profile: MerchantProfile; verifiedBadge: boolean; message: string }>(
    "/merchant/enable", { method: "POST", body: JSON.stringify(input) }
  );
}
export async function getMerchantAutopayApplications(): Promise<MerchantAutopayApplication[]> {
  return authenticatedRequest("/merchant/autopay-applications");
}
export async function applyForMerchantAutopay(reason: string): Promise<{ id: string; status: "pending"; message: string }> {
  return authenticatedRequest("/merchant/autopay-applications", { method: "POST", body: JSON.stringify({ reason }) });
}

