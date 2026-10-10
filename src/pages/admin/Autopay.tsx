import { useEffect, useState } from "react";
import { adminApi } from "../../api/admin";

type Mandate = {
  id: string;
  user_id: string;
  merchant_id: string;
  user_alias: string | null;
  merchant_alias: string | null;
  currency: string;
  status: string;
  cap_micro: number;
};

export default function Autopay() {
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await adminApi.autopay();
      setMandates(res.mandates as Mandate[]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function revoke(id: string) {
    if (!window.confirm("Revoke this autopay mandate? Customer consent is not re-collected.")) return;
    try {
      await adminApi.revokeAutopay(id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Autopay Controls</h1>
      <p className="text-sm text-gray-500">
        Merchant eligibility is separate from customer mandates. Revoking here stops an existing customer authorization.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {mandates.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  No autopay mandates
                </td>
              </tr>
            )}
            {mandates.map((m) => (
              <tr key={m.id} className="border-t border-gray-100">
                <td className="px-4 py-3">{m.user_alias || m.user_id}</td>
                <td className="px-4 py-3">{m.merchant_alias || m.merchant_id}</td>
                <td className="px-4 py-3">{m.status}</td>
                <td className="px-4 py-3 text-right">
                  {m.status === "active" && (
                    <button onClick={() => revoke(m.id)} className="text-sm text-red-600">
                      Revoke
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
