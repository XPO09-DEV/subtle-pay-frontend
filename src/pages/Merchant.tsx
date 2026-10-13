import { useEffect, useState, type FormEvent } from "react";
import Icon from "../components/Icon";
import { QRCodeSVG } from "qrcode.react";
import {
  applyForMerchantAutopay,
  enableMerchantProfile,
  getMerchantAutopayApplications,
  getMerchantProfile,
  type MerchantAutopayApplication,
  type MerchantProfile,
  getSignedPayQr,
} from "../services/accountService";

function formatDate(value: number | null | undefined): string {
  if (!value) return "Awaiting review";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

export default function Merchant() {
  const [merchant, setMerchant] = useState<MerchantProfile | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("individual");
  const [reason, setReason] = useState("");
  const [applications, setApplications] = useState<MerchantAutopayApplication[]>([]);
  const [busy, setBusy] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [merchantQr, setMerchantQr] = useState("");

  async function refresh() {
    setBusy(true);
    try {
      const [profile, history] = await Promise.all([getMerchantProfile(), getMerchantAutopayApplications()]);
      setEnabled(profile.enabled);
      setMerchant(profile.profile);
      setBusinessName(profile.profile?.publicName ?? "");
      setBusinessType(profile.profile?.category ?? "individual");
      setApplications(history);
    } catch (cause) {
      setNotice({ kind: "error", text: cause instanceof Error ? cause.message : "Merchant data could not be loaded." });
    } finally { setBusy(false); }
  }
  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    let alive = true;
    if (!enabled) { setMerchantQr(""); return () => { alive = false; }; }
    void getSignedPayQr()
      .then((value) => { if (alive) setMerchantQr(value.payload); })
      .catch(() => { if (alive) setMerchantQr(""); });
    return () => { alive = false; };
  }, [enabled]);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionBusy(true); setNotice(null);
    try {
      const result = await enableMerchantProfile({ publicName: businessName.trim() || undefined, category: businessType });
      setEnabled(result.enabled); setMerchant(result.profile);
      setNotice({ kind: "success", text: result.message });
    } catch (cause) {
      setNotice({ kind: "error", text: cause instanceof Error ? cause.message : "Merchant profile could not be enabled." });
    } finally { setActionBusy(false); }
  }
  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionBusy(true); setNotice(null);
    try {
      const result = await applyForMerchantAutopay(reason.trim());
      setApplications((items) => [{ id: result.id, reason: reason.trim(), status: result.status, createdAt: Date.now(), reviewedAt: null, reviewNote: null }, ...items]);
      setReason("");
      setNotice({ kind: "success", text: result.message });
    } catch (cause) {
      setNotice({ kind: "error", text: cause instanceof Error ? cause.message : "Autopay application could not be submitted." });
    } finally { setActionBusy(false); }
  }

  return (
    <div className="page-stack inner-page merchant-page">
      <div className="page-intro"><div><div className="section-kicker">BUSINESS TOOLS</div><h1>Merchant centre</h1><p>Use Subtle Pay for a public merchant profile; request separate approval for Autopay.</p></div><span className="page-icon-bubble"><Icon name="merchant" size={20} /></span></div>

      {notice && <div className={notice.kind === "success" ? "inline-notice success" : "inline-notice"} role="status"><Icon name={notice.kind === "success" ? "check-circle" : "info"} size={16} /><span>{notice.text}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><Icon name="close" size={14} /></button></div>}

      <section className="merchant-status-panel">
        <div className="merchant-status-icon"><Icon name="building" size={23} /></div>
        <div className="merchant-status-content">
          <span className={merchant?.status === "approved" ? "merchant-verified-badge" : "status-pill neutral"}>{merchant?.status === "approved" ? "✓ Verified merchant" : enabled ? "Merchant enabled" : "Not enabled"}</span>
          <h2>{merchant?.publicName ?? "Become a Subtle Pay merchant"}</h2>
          <p>{merchant?.status === "approved" ? "Your merchant profile has been approved by the Subtle Pay team." : "Anyone can enable a merchant profile. A verified badge is shown only after staff approval; Autopay remains a separate approval."}</p>
        </div>
      </section>

      {enabled && <section className="panel merchant-receive-qr">
        <div className="panel-heading compact"><div><div className="section-kicker">CUSTOMER PAYMENTS</div><h2>Merchant payment QR</h2><p>Customers can scan this code to pay this Subtle Pay account.</p></div><span className="status-pill neutral">MON</span></div>
        <div className="merchant-pay-qr-wrap">{merchantQr ? <QRCodeSVG value={merchantQr} size={196} level="H" includeMargin imageSettings={{ src: "/subtle-pay-mark.svg", width: 36, height: 36, excavate: true }} /> : <div className="merchant-pay-qr-loading" role="status">Loading secure payment QR…</div>}</div>
        <p className="tiny-note">Payments settle only through the account's configured Monad Testnet payment flow.</p>
      </section>}

      <section className="panel">
        <div className="panel-heading compact"><div><div className="section-kicker">PUBLIC PROFILE</div><h2>{enabled ? "Update merchant details" : "Enable merchant profile"}</h2></div><span className="step-number">01</span></div>
        {busy ? <div className="history-loading"><span className="ta-search-spinner" /><strong>Loading merchant status…</strong></div> :
          <form className="form-stack" onSubmit={(event) => void register(event)}>
            <label className="field-label" htmlFor="merchant-public-name">Public name</label>
            <input id="merchant-public-name" className="form-input" value={businessName} onChange={(event) => setBusinessName(event.target.value)} maxLength={80} placeholder="Your name or shop name" />
            <label className="field-label" htmlFor="merchant-category">Merchant category</label>
            <select id="merchant-category" className="form-select" value={businessType} onChange={(event) => setBusinessType(event.target.value)}>
              <option value="individual">Individual / creator</option><option value="retail">Retail</option><option value="services">Services</option><option value="online">Online business</option><option value="other">Other</option>
            </select>
            <p className="tiny-note">You can enable a basic merchant profile without uploading identity documents in this prototype. This does not grant the yellow verified badge or activate Autopay.</p>
            <button className="primary-button wide-button" type="submit" disabled={actionBusy}>{actionBusy ? "Saving…" : enabled ? "Save merchant profile" : "Enable merchant profile"}</button>
          </form>}
      </section>

      <section className="panel">
        <div className="panel-heading compact"><div><div className="section-kicker">RECURRING PAYMENTS</div><h2>Apply for Autopay</h2></div><span className="feature-access-icon"><Icon name="refresh" size={18} /></span></div>
        <p className="body-copy">Autopay applications are reviewed separately. Payments are not scheduled or executed just because an application was submitted.</p>
        <form className="form-stack" onSubmit={(event) => void apply(event)}>
          <label className="field-label" htmlFor="merchant-autopay-reason">Use case</label>
          <textarea id="merchant-autopay-reason" className="form-input merchant-reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={1000} rows={4} required placeholder="Explain why your merchant account needs recurring payments." />
          <button className="secondary-button wide-button" type="submit" disabled={!enabled || actionBusy}>{actionBusy ? "Submitting…" : "Submit Autopay application"}</button>
        </form>
        {applications.length > 0 && <div className="merchant-applications">
          <h3>Your applications</h3>
          {applications.map((application) => <article key={application.id}>
            <div><strong>{application.status === "pending" ? "Pending review" : application.status === "approved" ? "Approved" : "Rejected"}</strong><small>{formatDate(application.createdAt)}</small><p>{application.reason}</p>{application.reviewNote && <small>Review note: {application.reviewNote}</small>}</div>
            <span className={application.status === "approved" ? "status-pill success" : application.status === "rejected" ? "status-pill warning" : "status-pill neutral"}>{application.status}</span>
          </article>)}
        </div>}
      </section>
      <p className="history-disclaimer">The verified badge is a review status, not a claim that all payment or regulatory checks have been completed.</p>
    </div>
  );
}
