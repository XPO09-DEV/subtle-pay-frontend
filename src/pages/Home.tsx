import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Me, Payment, Wallet } from "../types/api";
import BalanceCard from "../components/BalanceCard";
import BottomNav from "../components/BottomNav";
import TransactionItem from "../components/TransactionItem";

export default function Home() {
  const [me, setMe] = useState<Me | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    api.getMe().then(setMe);
    api.getWallet().then(setWallet);
    api.getPayments().then(setPayments);
  }, []);

  return (
    <div className="space-y-5 p-5 pb-24">
      <p className="text-sm text-gray-500">Good evening, <b>@{me?.alias ?? "friend"}</b></p>
      {wallet ? <BalanceCard wallet={wallet} /> : <p>Loading...</p>}

      <div className="grid grid-cols-2 gap-3">
        <Link to="/send" className="rounded-xl bg-white p-4 text-center font-medium shadow-sm">Send</Link>
        <Link to="/receive" className="rounded-xl bg-white p-4 text-center font-medium shadow-sm">Receive</Link>
      </div>
      <Link to="/withdraw" className="block text-center text-sm text-brand">Withdraw to bank</Link>

      <div className="flex justify-between">
        <h2 className="font-semibold">Recent activity</h2>
        <Link to="/history" className="text-sm text-brand">See all</Link>
      </div>
      {payments.slice(0, 3).map((tx) => (
        <TransactionItem key={tx.id} tx={tx} currency={me?.currency} />
      ))}
      <BottomNav />
    </div>
  );
}