import type { Payment } from "../types/api";
import { money } from "../utils/format";

type Props = { tx: Payment; showLocal?: boolean; currency?: string };

export default function TransactionItem({ tx, showLocal, currency = "INR" }: Props) {
  const incoming = tx.direction === "in";
  const main = showLocal ? money(tx.localValue, currency) : money(tx.usdValue);
  const small = showLocal ? money(tx.usdValue) : money(tx.localValue, currency);

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-soft font-semibold text-brand">
        {tx.counterparty[0]?.toUpperCase()}
      </div>
      <div className="flex-1">
        <p className="font-medium">{tx.counterparty}</p>
        <p className="text-xs text-gray-400">
          {incoming ? "Received" : "Sent"} · {new Date(tx.createdAt).toLocaleDateString()}
        </p>
      </div>
      <div className="text-right">
        <p className={`font-semibold ${incoming ? "text-brand" : ""}`}>
          {incoming ? "+" : "-"}
          {main}
        </p>
        <p className="text-xs text-gray-400">({small})</p>
      </div>
    </div>
  );
}