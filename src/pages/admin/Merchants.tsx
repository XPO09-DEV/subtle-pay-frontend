import { useEffect, useState } from "react";
import { adminApi } from "../../api/admin";

type Merchant = {
  user_id: string;
  business_name: string;
  status: string;
  contact: string | null;
  note: string | null;
};

export default function Merchants() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await adminApi.merchants();
      setMerchants(res.merchants as Merchant[]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function review(id: string, approve: boolean) {
    const note = approve ? undefined : window.prompt("Rejection note (optional)") || undefined;
    if (!approve && !window.confirm("Reject this merchant?")) return;
    try {
      await adminApi.reviewMerchant(id, approve, note);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Merchant Management</h1>
      <p className="text-sm text-gray-500">Verification is required before a business can receive autopay.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="space-y-3">
        {merchants.length === 0 && <p className="text-sm text-gray-400">No merchant applications.</p>}
        {merchants.map((m) => (
          <div key={m.user_id} className="rounded-2xl border border-black/5 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{m.business_name}</p>
                <p className="font-mono text-xs text-gray-500">{m.user_id}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">{m.status}</p>
              </div>
              {m.status === "pending" && (
                <div className="flex gap-2">
                  <button onClick={() => review(m.user_id, true)} className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white">
                    Approve
                  </button>
                  <button onClick={() => review(m.user_id, false)} className="rounded-lg border px-3 py-1.5 text-xs">
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
