import { useState, type ChangeEvent } from "react";
import { setAccountCurrency } from "../services/accountService";
import { CURRENCIES, DEFAULT_CURRENCY_KEY, readDefaultCurrency } from "../data/currencies";
import "./CurrencyPreference.css";

export default function CurrencyPreference({ initialCurrency }: { initialCurrency?: string }) {
  const [currency, setCurrency] = useState(() => (initialCurrency || readDefaultCurrency()).toLowerCase());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveDefault() {
    setSaving(true);
    setError("");
    try {
      await setAccountCurrency(currency);
      window.localStorage.setItem(DEFAULT_CURRENCY_KEY, currency);
      window.dispatchEvent(new CustomEvent("subtlepay:default-currency", { detail: currency }));
      setSaved(true);
    } catch (cause) {
      setSaved(false);
      setError(cause instanceof Error ? cause.message : "Could not save currency preference.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="currency-pref-card" aria-labelledby="currency-pref-heading">
      <div className="currency-pref-heading-row">
        <span className="currency-pref-symbol" aria-hidden="true">{CURRENCIES.find((item) => item.code === currency)?.symbol ?? "$"}</span>
        <div>
          <h2 id="currency-pref-heading">Default display currency</h2>
          <p>Your token prices and portfolio totals will use this currency whenever you open the wallet.</p>
        </div>
      </div>
      <label className="currency-pref-label" htmlFor="currency-pref-select">Currency</label>
      <select id="currency-pref-select" className="currency-pref-select" value={currency} onChange={(event: ChangeEvent<HTMLSelectElement>) => { setCurrency(event.target.value); setSaved(false); }}>
        {CURRENCIES.map((option) => (
          <option key={option.code} value={option.code}>{option.symbol}  {option.code.toUpperCase()} — {option.name}</option>
        ))}
      </select>
      <button type="button" className="currency-pref-save" onClick={() => void saveDefault()} disabled={saving}>{saving ? "Saving…" : "Save default currency"}</button>
      {error && <p className="currency-pref-feedback" role="alert">{error}</p>}
      <p className={saved ? "currency-pref-feedback saved" : "currency-pref-feedback"} role="status">
        {saved ? `Default currency saved as ${currency.toUpperCase()}.` : "Your preference is synced to your Subtle Pay account."}
      </p>
    </section>
  );
}
