import { useEffect, useState } from "react";
import { adminApi } from "../../api/admin";

type User = {
  accountId: string;
  alias: string | null;
  currency: string;
  address: string | null;
  banned: boolean;
  banReason: string | null;
};

export default function Users() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function load(query = q) {
    setError("");
    try {
      const res = await adminApi.users(query);
      setUsers(res.users as User[]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    void load("");
  }, []);

  async function ban(id: string) {
    const reason = window.prompt("Reason for ban");
    if (!reason) return;
    setBusy(id);
    try {
      await adminApi.ban(id, reason);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function unban(id: string) {
    if (!window.confirm("Lift this ban?")) return;
    setBusy(id);
    try {
      await adminApi.unban(id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Users & Access</h1>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search account ID, alias, or address"
          className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900"
        />
        <button className="rounded-xl bg-gray-900 px-4 text-sm text-white">Search</button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Alias</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  No users
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.accountId} className="border-t border-gray-100">
                <td className="px-4 py-3 font-mono text-xs">{u.accountId}</td>
                <td className="px-4 py-3">{u.alias || "—"}</td>
                <td className="px-4 py-3">
                  {u.banned ? <span className="text-red-600">Banned</span> : <span className="text-green-700">Active</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  {u.banned ? (
                    <button disabled={busy === u.accountId} onClick={() => unban(u.accountId)} className="text-sm text-gray-700">
                      Unban
                    </button>
                  ) : (
                    <button disabled={busy === u.accountId} onClick={() => ban(u.accountId)} className="text-sm text-red-600">
                      Ban
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
