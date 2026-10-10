import { useEffect, useState } from "react";
import { adminApi } from "../../api/admin";

type Log = { seq: number; ts: number; actor: string | null; action: string; details: string | null; ip: string | null };

export default function Audit() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi
      .audit()
      .then((r) => setLogs(r.logs as Log[]))
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Audit Logs</h1>
      <p className="text-sm text-gray-500">Append-only, hash-chained. Secrets are never stored here.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                  No events
                </td>
              </tr>
            )}
            {logs.map((l) => (
              <tr key={l.seq} className="border-t border-gray-100">
                <td className="px-4 py-3 text-xs text-gray-500">{new Date(l.ts).toLocaleString()}</td>
                <td className="px-4 py-3 font-mono text-xs">{l.actor || "—"}</td>
                <td className="px-4 py-3">{l.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
