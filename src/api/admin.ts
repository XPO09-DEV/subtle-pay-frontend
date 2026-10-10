const BASE = import.meta.env.VITE_API_URL || "";

export const getAdminToken = () => sessionStorage.getItem("admin_token");
export const saveAdminToken = (t: string) => sessionStorage.setItem("admin_token", t);
export const clearAdminToken = () => sessionStorage.removeItem("admin_token");

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getAdminToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || "Request failed");
  return data as T;
}

export const adminApi = {
  login: (name: string, password: string) =>
    request<{ token: string; admin: { id: string; email: string; role: string } }>("POST", "/admin/login", {
      email: name,
      password,
    }),
  me: () => request<{ id: string; email: string; role: string }>("GET", "/admin/me"),
  logout: () => request<{ ok: boolean }>("POST", "/admin/logout"),
  overview: () =>
    request<{
      users: number;
      banned: number;
      pendingMerchants: number;
      verifiedMerchants: number;
      activeAutopay: number;
      payments: number;
      health: string;
    }>("GET", "/admin/overview"),
  users: (q = "") => request<{ users: Array<Record<string, unknown>> }>("GET", `/admin/users?q=${encodeURIComponent(q)}`),
  user: (id: string) => request<Record<string, unknown>>("GET", `/admin/users/${id}`),
  ban: (id: string, reason: string) => request<{ ok: boolean }>("POST", `/admin/users/${id}/ban`, { reason }),
  unban: (id: string) => request<{ ok: boolean }>("POST", `/admin/users/${id}/unban`),
  merchants: (status = "") =>
    request<{ merchants: Array<Record<string, unknown>> }>("GET", `/admin/merchants${status ? `?status=${status}` : ""}`),
  reviewMerchant: (id: string, approve: boolean, note?: string) =>
    request<{ ok: boolean; status: string }>("POST", `/admin/merchants/${id}/review`, { approve, note }),
  autopay: () => request<{ mandates: Array<Record<string, unknown>> }>("GET", "/admin/autopay"),
  revokeAutopay: (id: string) => request<{ ok: boolean }>("POST", `/admin/autopay/${id}/revoke`),
  audit: () => request<{ logs: Array<Record<string, unknown>> }>("GET", "/admin/audit"),
  health: () => request<{ ok: boolean; db: string; time: string }>("GET", "/admin/health"),
  tables: () => request<{ tables: string[] }>("GET", "/admin/db/tables"),
  table: (name: string) => request<{ table: string; rows: Array<Record<string, unknown>> }>("GET", `/admin/db/${name}`),
};
