import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Me, Payment } from "../types/api";
import BottomNav from "../components/BottomNav";
import TransactionItem from "../components/TransactionItem";

export default function History() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [showLocal, setShowLocal] = useState(false);

  useEffect(() => {
    api.getPayments().then(setPayments);
    api.getMe().then(setMe);
  }, []);

  const tab = (active: boolean) =>
    `flex-1 rounded-full py-2 text-center ${active ? "bg-brand text-white" : ""}`;

  return (
    <div className="space-y-3 p-5 pb-24">
      <h1 className="text-center text-lg font-semibold">Transaction history</h1>
      <div className="flex rounded-full bg-gray-100 text-sm">
        <button className={tab(!showLocal)} onClick={() => setShowLocal(false)}>USD</button>
        <button className={tab(showLocal)} onClick={() => setShowLocal(true)}>{me?.currency ?? "INR"}</button>
      </div>
      {payments.length === 0 && <p className="text-center text-gray-400">No transactions yet</p>}
      {payments.map((tx) => (
        <TransactionItem key={tx.id} tx={tx} showLocal={showLocal} currency={me?.currency} />
      ))}
      <BottomNav />
    </div>
  );
}