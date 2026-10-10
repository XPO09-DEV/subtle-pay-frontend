import { useEffect, useState } from "react";
import { adminApi } from "../../api/admin";

export default function Database() {
  const [tables, setTables] = useState<string[]>([]);
  const [active, setActive] = useState("");
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi
      .tables()
      .then((r) => {
        setTables(r.tables);
        if (r.tables[0]) setActive(r.tables[0]);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    if (!active) return;
    adminApi
      .table(active)
      .then((r) => setRows(r.rows))
      .catch((e) => setError((e as Error).message));
  }, [active]);

  const cols = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Database Explorer</h1>
      <p className="text-sm text-gray-500">Read-only. Password hashes, MPINs, and private keys are redacted.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {tables.map((t) => (
          <button
            key={t}
            onClick={() => setActive(t)}
            className={`rounded-full px-3 py-1 text-xs ${active === t ? "bg-gray-900 text-white" : "bg-white border"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="overflow-auto rounded-2xl border border-black/5 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              {cols.map((c) => (
                <th key={c} className="px-3 py-2">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-8 text-center text-gray-400" colSpan={Math.max(1, cols.length)}>
                  No rows
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-gray-100">
                {cols.map((c) => (
                  <td key={c} className="max-w-[200px] truncate px-3 py-2">
                    {String(r[c] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
