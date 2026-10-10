import { useEffect, useState } from "react";
import { adminApi } from "../../api/admin";

export default function Overview() {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminApi.overview>> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi.overview().then(setData).catch((e) => setError((e as Error).message));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-gray-500">Loading…</p>;

  const cards = [
    { label: "Users", value: data.users },
    { label: "Banned", value: data.banned },
    { label: "Pending merchants", value: data.pendingMerchants },
    { label: "Verified merchants", value: data.verifiedMerchants },
    { label: "Active autopay", value: data.activeAutopay },
    { label: "Payments", value: data.payments },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-gray-500">Live platform metrics from the database.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-black/5 bg-white p-5">
            <p className="text-sm text-gray-500">{c.label}</p>
            <p className="mt-1 text-3xl font-semibold">{c.value}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400">Health: {data.health}</p>
    </div>
  );
}
