import { useEffect, useState, type ChangeEvent } from "react";
import { CURRENCIES } from "../data/currencies";
import { getAccountProfile, getSupportedCurrencies, updateAccountCurrency } from "../services/accountService";
import "./CurrencyPreference.css";

export default function CurrencyPreference() {
  const [currency, setCurrency] = useState("USD");
  const [supported, setSupported] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    Promise.all([getAccountProfile(), getSupportedCurrencies()]).then(([profile, currencies]) => {
      if (!alive) return;
      setCurrency(profile.currency);
      setSupported(currencies);
    }).catch((cause: unknown) => { if (alive) setError(cause instanceof Error ? cause.message : "Account preferences could not be loaded."); });
    return () => { alive = false; };
  }, []);
  async function saveDefault() {
    setSaved(false); setError("");
    try {
      const result = await updateAccountCurrency(currency);
      setCurrency(result.currency); setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Currency preference could not be saved.");
    }
  }

  return (
    <section className="currency-pref-card" aria-labelledby="currency-pref-heading">
      <div className="currency-pref-heading-row">
        <span className="currency-pref-symbol" aria-hidden="true">{CURRENCIES.find((item) => item.code.toUpperCase() === currency)?.symbol ?? "$"}</span>
        <div>
          <h2 id="currency-pref-heading">Default display currency</h2>
          <p>Your token prices and portfolio totals will use this currency whenever you open the wallet.</p>
        </div>
      </div>
      <label className="currency-pref-label" htmlFor="currency-pref-select">Currency</label>
      <select id="currency-pref-select" className="currency-pref-select" value={currency} onChange={(event: ChangeEvent<HTMLSelectElement>) => { setCurrency(event.target.value); setSaved(false); }}>
        {CURRENCIES.filter((option) => supported.includes(option.code.toUpperCase())).map((option) => (
          <option key={option.code} value={option.code.toUpperCase()}>{option.symbol}  {option.code.toUpperCase()} — {option.name}</option>
        ))}
      </select>
      <button type="button" className="currency-pref-save" onClick={saveDefault}>Save default currency</button>
      <p className={saved ? "currency-pref-feedback saved" : "currency-pref-feedback"} role="status">{error || (saved ? `Default currency saved as ${currency.toUpperCase()}.` : "Changes are saved to your Subtle Pay account.")}</p>
    </section>
  );
}
