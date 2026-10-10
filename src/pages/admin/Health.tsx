import { useEffect, useState } from "react";
import { adminApi } from "../../api/admin";

export default function Health() {
  const [data, setData] = useState<{ ok: boolean; db: string; time: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi
      .health()
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">System Health</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && (
        <div className="rounded-2xl border border-black/5 bg-white p-5">
          <p className="text-sm">API: {data.ok ? "healthy" : "degraded"}</p>
          <p className="text-sm">Database: {data.db}</p>
          <p className="text-xs text-gray-500">{data.time}</p>
        </div>
      )}
    </div>
  );
}
