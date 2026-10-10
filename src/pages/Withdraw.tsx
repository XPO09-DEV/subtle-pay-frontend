import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Wallet } from "../types/api";
import Button from "../components/Button";
import Input from "../components/Input";
import { money } from "../utils/format";

export default function Withdraw() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  useEffect(() => { api.getWallet().then(setWallet); }, []);

  async function submit() {
    try {
      const r = await api.withdraw(Number(amount), "USD");
      setMsg(`Done! You will get ${money(r.payoutLocal, wallet?.currency)}`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <div className="space-y-4 p-6">
      <button onClick={() => navigate(-1)} className="text-brand">← Back</button>
      <h1 className="text-xl font-semibold">Withdraw</h1>
      {wallet && (
        <div className="rounded-xl bg-white p-4">
          <p className="text-xs text-gray-500">Available balance</p>
          <p className="text-2xl font-semibold">{money(wallet.balanceUsd)}</p>
        </div>
      )}
      <Input label="Amount (USD)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-700">
        This is a testnet prototype. No real money is transferred.
      </p>
      {msg && <p className="text-sm">{msg}</p>}
      <Button onClick={submit} disabled={!amount}>Withdraw</Button>
    </div>
  );
}