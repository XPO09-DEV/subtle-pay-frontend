import { useEffect, useState } from "react";
import Icon from "../components/Icon";
import { getPaymentHistory, type PaymentRecord } from "../services/accountService";

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString();
}

export default function Notifications() {
  const [items, setItems] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function refresh() {
    setLoading(true); setError("");
    try { setItems(await getPaymentHistory({ limit: 30 })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Notifications are unavailable."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  return <div className="page-stack inner-page">
    <div className="page-intro"><div><div className="section-kicker">INBOX</div><h1>Notifications</h1><p>Recent payment updates from your Subtle Pay account.</p></div><span className="page-icon-bubble notification-page-icon"><Icon name="bell" size={20} /></span></div>
    <div className="activity-toolbar"><span className="activity-toolbar-note">Backend transaction status</span><button className="secondary-button" type="button" onClick={() => void refresh()} disabled={loading}><Icon name="refresh" size={15} /> Refresh</button></div>
    {error && <div className="inline-notice" role="alert">{error}</div>}
    {loading ? <section className="panel"><p>Loading recent payment updates…</p></section> : items.length === 0 ? <section className="panel activity-empty-panel notification-empty-panel"><div className="notification-empty-illustration"><span className="notification-illustration-bell"><Icon name="bell" size={28} /></span></div><h2>You're all caught up</h2><p>Payment updates will appear here after the backend records activity.</p></section> : <section className="panel activity-list">{items.map((item) => <article className="transaction-row" key={item.id}><span className="transaction-icon"><Icon name={item.status === "confirmed" ? "check-circle" : item.status === "failed" ? "alert" : "clock"} size={18} /></span><div className="transaction-copy"><strong>{item.direction === "out" ? `Payment to ${item.counterparty}` : `Payment from ${item.counterparty}`}</strong><small>{formatTime(item.createdAt)} · {item.status}</small>{item.txHash && <small className="transaction-hash">{item.txHash}</small>}</div><span className="transaction-amount">${item.usdValue}</span></article>)}</section>}
  </div>;
}
