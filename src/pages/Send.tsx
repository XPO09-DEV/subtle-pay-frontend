import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import Button from "../components/Button";
import Input from "../components/Input";
import { money } from "../utils/format";

export default function Send() {
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [note, setNote] = useState("");
  const [mpin, setMpin] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function goConfirm() {
    setError("");
    try {
      const handle = to.trim().toLowerCase().replace(/@monad$/, "").replace(/^@/, "");
      if (!to.startsWith("0x")) await api.resolveAlias(handle);
      setStep("confirm");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function payWithMpin() {
    if (!mpin) {
      setError("Enter your MPIN");
      return;
    }
    try {
      await api.send(to, amount, currency, { mpin }, note);
      setStep("done");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function payWithBiometric() {
    setError("");
    try {
      const { challenge, credentials } = await api.biometricAuthOptions();
      if (!credentials.length) throw new Error("No biometric registered");

      const challengeBuf = Uint8Array.from(atob(challenge.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
      const allowCredentials = credentials.map((c) => ({
        type: "public-key" as const,
        id: Uint8Array.from(atob(c.id.replace(/-/g, "+").replace(/_/g, "/")), (ch) => ch.charCodeAt(0)),
      }));

      const assertion = (await navigator.credentials.get({
        publicKey: {
          challenge: challengeBuf,
          allowCredentials,
          userVerification: "required",
          timeout: 60000,
        },
      })) as PublicKeyCredential | null;

      if (!assertion) throw new Error("Biometric cancelled");

      const response = assertion.response as AuthenticatorAssertionResponse;
      const signature = btoa(String.fromCharCode(...new Uint8Array(response.signature)));

      await api.send(to, amount, currency, {
        biometric: { credentialId: assertion.id, challenge, signature },
      }, note);
      setStep("done");
    } catch (e) {
      setError((e as Error).message || "Biometric failed — use MPIN instead");
    }
  }

  if (step === "done") {
    return (
      <div className="space-y-4 p-6 pt-32 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand text-4xl text-white">✓</div>
        <h1 className="text-2xl font-semibold">Payment sent!</h1>
        <p className="text-3xl font-bold">{money(Number(amount), currency)}</p>
        <p>to {to}</p>
        <Button onClick={() => navigate("/")}>Done</Button>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="space-y-4 p-6 pt-20">
        <h1 className="text-xl font-semibold">Confirm payment</h1>
        <p className="text-4xl font-bold">{money(Number(amount), currency)}</p>
        <p>To: <b>{to}</b></p>
        {note && <p>Note: {note}</p>}
        <Input
          label="MPIN (4-6 digits)"
          type="password"
          inputMode="numeric"
          value={mpin}
          onChange={(e) => setMpin(e.target.value)}
          maxLength={6}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button onClick={payWithBiometric}>Pay with Face / Fingerprint</Button>
        <Button onClick={payWithMpin}>Confirm with MPIN</Button>
        <Button variant="light" onClick={() => setStep("form")}>Cancel</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <button onClick={() => navigate(-1)} className="text-brand">← Back</button>
      <h1 className="text-xl font-semibold">Send money</h1>
      <Input label="To (name or address)" value={to} onChange={(e) => setTo(e.target.value)} />
      <Input label="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full rounded-xl border bg-white p-3">
        <option>USD</option>
        <option>INR</option>
      </select>
      <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button onClick={goConfirm} disabled={!to || !amount}>Continue</Button>
    </div>
  );
}
