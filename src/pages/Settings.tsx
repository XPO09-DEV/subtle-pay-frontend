import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import type { Me } from "../types/api";
import BottomNav from "../components/BottomNav";
import Button from "../components/Button";
import Input from "../components/Input";

export default function Settings() {
  const [me, setMe] = useState<Me | null>(null);
  const [alias, setAlias] = useState("");
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [msg, setMsg] = useState("");
  const { logout } = useAuth();

  useEffect(() => { api.getMe().then(setMe); }, []);

  // runs any action and shows success or error text
  async function run(action: () => Promise<unknown>, ok: string) {
    try {
      await action();
      setMsg(ok);
      api.getMe().then(setMe);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <div className="space-y-4 p-5 pb-24">
      <h1 className="text-center text-lg font-semibold">Settings</h1>
      <div className="break-all rounded-xl bg-white p-4 text-sm">
        <b>@{me?.alias ?? "no name yet"}</b>
        <p className="text-gray-400">{me?.accountId}</p>
      </div>

      <select
        value={me?.currency ?? "USD"}
        onChange={(e) => run(() => api.setCurrency(e.target.value), "Currency updated")}
        className="w-full rounded-xl border bg-white p-3"
      >
        <option>USD</option>
        <option>INR</option>
      </select>

      <Input label="Choose a name (alias)" value={alias} onChange={(e) => setAlias(e.target.value)} />
      <Button variant="light" onClick={() => run(() => api.setAlias(alias), "Name saved")}>Save name</Button>

      <Input label="Old password" type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
      <Input label="New password" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
      <Button variant="light" onClick={() => run(() => api.changePassword(oldPw, newPw), "Password changed")}>
        Change password
      </Button>

      {msg && <p className="text-center text-sm text-gray-600">{msg}</p>}
      <Button variant="danger" onClick={logout}>Log out</Button>
      <BottomNav />
    </div>
  );
}