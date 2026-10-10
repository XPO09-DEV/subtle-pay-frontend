import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import type { Me } from "../types/api";
import BottomNav from "../components/BottomNav";
import Button from "../components/Button";
import Input from "../components/Input";

export default function Settings() {
  const [me, setMe] = useState<(Me & { hasMpin?: boolean }) | null>(null);
  const [alias, setAlias] = useState("");
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [mpin, setMpin] = useState("");
  const [oldMpin, setOldMpin] = useState("");
  const [newMpin, setNewMpin] = useState("");
  const [msg, setMsg] = useState("");
  const { logout } = useAuth();

  useEffect(() => { api.getMe().then(setMe); }, []);

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
        <p className="text-xs text-gray-500 mt-1">MPIN: {me?.hasMpin ? "set" : "not set"}</p>
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

      {!me?.hasMpin && (
        <>
          <Input label="Set MPIN (4-6 digits)" type="password" inputMode="numeric" value={mpin} onChange={(e) => setMpin(e.target.value)} maxLength={6} />
          <Button variant="light" onClick={() => run(() => api.setMpin(mpin), "MPIN set")}>Set MPIN</Button>
        </>
      )}

      {me?.hasMpin && (
        <>
          <Input label="Old MPIN" type="password" value={oldMpin} onChange={(e) => setOldMpin(e.target.value)} />
          <Input label="New MPIN" type="password" value={newMpin} onChange={(e) => setNewMpin(e.target.value)} />
          <Button variant="light" onClick={() => run(() => api.changeMpin(oldMpin, newMpin), "MPIN changed")}>Change MPIN</Button>
        </>
      )}

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
