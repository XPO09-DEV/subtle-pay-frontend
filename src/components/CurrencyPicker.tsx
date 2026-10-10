import { useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { CURRENCIES } from "../utils/currencies";

type Props = {
  value: string;
  onChange: (code: string) => void;
  className?: string;
};

export default function CurrencyPicker({ value, onChange, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const list = Object.entries(CURRENCIES).filter(([code, c]) =>
    (code + " " + c.name).toLowerCase().includes(q.toLowerCase())
  );

  function pick(code: string) {
    onChange(code);
    setOpen(false);
    setQ("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center justify-between gap-1 rounded-xl border border-gray-200 bg-white px-3 py-3 font-medium ${className}`}
      >
        {value} <ChevronDown size={16} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Choose currency</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close">
                <X />
              </button>
            </div>

            <div className="mb-3 flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2">
              <Search size={18} className="text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search (e.g. euro or EUR)"
                className="w-full bg-transparent outline-none"
              />
            </div>

            <div className="overflow-y-auto">
              {list.map(([code, c]) => (
                <button
                  type="button"
                  key={code}
                  onClick={() => pick(code)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left ${
                    code === value ? "bg-soft text-brand" : ""
                  }`}
                >
                  <span>{c.name}</span>
                  <span className="text-sm text-gray-500">{code}</span>
                </button>
              ))}
              {list.length === 0 && <p className="p-4 text-center text-gray-400">No match</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}