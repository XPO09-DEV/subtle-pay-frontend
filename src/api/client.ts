import type { Me, Payment, Rates, SendResult, Wallet } from "../types/api";

const BASE = import.meta.env.VITE_API_URL || "";

export const getToken = () => localStorage.getItem("token");
export const saveToken = (t: string) => localStorage.setItem("token", t);
export const clearToken = () => localStorage.removeItem("token");

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || "Something went wrong");
  return data as T;
}

export const api = {
  register: (password: string) =>
    request<{ accountId: string; token: string }>("POST", "/auth/register", { password }),
  login: (accountId: string, password: string) =>
    request<{ token: string }>("POST", "/auth/login", { accountId, password }),
  logout: () => request<{ ok: boolean }>("POST", "/auth/logout"),
  changePassword: (oldPassword: string, newPassword: string) =>
    request<{ ok: boolean }>("POST", "/auth/change-password", { oldPassword, newPassword }),
  setMpin: (mpin: string) => request<{ ok: boolean }>("POST", "/auth/set-mpin", { mpin }),
  changeMpin: (oldMpin: string, newMpin: string) =>
    request<{ ok: boolean }>("POST", "/auth/change-mpin", { oldMpin, newMpin }),
  biometricStatus: () => request<{ hasBiometric: boolean }>("GET", "/auth/biometric/status"),
  biometricRegisterOptions: () =>
    request<{ challenge: string; userId: string }>("POST", "/auth/biometric/register/options"),
  biometricRegisterVerify: (credentialId: string, publicKey: string, transports?: string) =>
    request<{ ok: boolean }>("POST", "/auth/biometric/register/verify", { credentialId, publicKey, transports }),
  biometricAuthOptions: () =>
    request<{ challenge: string; credentials: { id: string; transports: string | null }[] }>(
      "POST",
      "/auth/biometric/auth/options"
    ),
  getMe: () => request<Me & { hasMpin?: boolean }>("GET", "/me"),
  setCurrency: (currency: string) => request<{ currency: string }>("PUT", "/me/currency", { currency }),
  getWallet: () => request<Wallet>("GET", "/wallet"),
  setAlias: (alias: string) => request<{ alias: string }>("POST", "/alias", { alias }),
  resolveAlias: (name: string) => request<{ alias: string; address: string }>("GET", `/alias/${name}`),
  getRates: (currency: string) => request<Rates>("GET", `/rates?currency=${currency}`),
  send: (
    to: string,
    amount: number | string,
    amountCurrency: string,
    auth: { mpin?: string; biometric?: { credentialId: string; challenge: string; signature: string } },
    note?: string
  ) =>
    request<SendResult>("POST", "/payments/send", {
      to,
      amount,
      amountCurrency,
      note,
      mpin: auth.mpin,
      biometric: auth.biometric,
    }),
  getPayments: async () => {
    const data = await request<Payment[] | { payments: Payment[] }>("GET", "/payments");
    return Array.isArray(data) ? data : data.payments;
  },
  withdraw: (amount: number, currency: string) =>
    request<{ withdrawalId: string; status: string; payoutLocal: number }>("POST", "/withdraw", {
      amount,
      currency,
    }),
};
