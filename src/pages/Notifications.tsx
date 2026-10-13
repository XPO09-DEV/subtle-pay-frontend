import { useCallback, useEffect, useState } from "react";
import Icon from "../components/Icon";
import { getNotifications, markAllNotificationsRead, markNotificationRead, type AccountNotification } from "../services/accountService";

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

function notificationIcon(type: string) {
  if (type === "payment_confirmed") return "check-circle" as const;
  if (type === "payment_failed") return "alert-circle" as const;
  return "activity" as const;
}

export default function Notifications() {
  const [items, setItems] = useState<AccountNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [busy, setBusy] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const page = await getNotifications({ limit: 50, offset: 0 });
      setItems(page.items);
      setUnreadCount(page.unreadCount);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Notifications could not be loaded.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function markRead(item: AccountNotification) {
    if (item.readAt) return;
    try {
      const response = await markNotificationRead(item.id);
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, readAt: response.readAt } : row));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not mark notification as read.");
    }
  }

  async function markAllRead() {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    setError("");
    try {
      const response = await markAllNotificationsRead();
      setItems((current) => current.map((row) => row.readAt ? row : { ...row, readAt: response.readAt }));
      setUnreadCount(0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not mark notifications as read.");
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="page-stack inner-page">
      <div className="page-intro">
        <div><div className="section-kicker">INBOX</div><h1>Notifications</h1><p>Payment status and account updates from Subtle Pay.</p></div>
        <span className="page-icon-bubble notification-page-icon"><Icon name="bell" size={20} /></span>
      </div>
      <section className="panel">
        <div className="panel-heading compact">
          <div><div className="section-kicker">ACCOUNT INBOX</div><h2>{unreadCount} unread</h2></div>
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => void refresh()} disabled={busy}><Icon name="refresh" size={15} /> Refresh</button>
            <button type="button" className="secondary-button" onClick={() => void markAllRead()} disabled={markingAll || unreadCount === 0}>{markingAll ? "Saving…" : "Mark all read"}</button>
          </div>
        </div>
        {error && <div className="inline-notice" role="alert"><Icon name="info" size={16} /><span>{error}</span></div>}
        {busy ? <div className="empty-activity"><span className="ta-search-spinner" /><strong>Loading notifications…</strong></div>
          : items.length === 0 ? <div className="empty-state-illustration"><Icon name="bell" size={25} /><h2>You’re all caught up</h2><p>Payment submissions, confirmations and failures will appear here.</p></div>
          : <div className="payment-history-list">{items.map((item) => (
              <button key={item.id} type="button" className="payment-history-row" onClick={() => void markRead(item)} style={{ width: "100%", textAlign: "left", opacity: item.readAt ? 0.75 : 1 }} aria-label={item.readAt ? item.title : `Mark ${item.title} as read`}>
                <span className={item.type === "payment_confirmed" ? "payment-direction-icon incoming" : item.type === "payment_failed" ? "payment-direction-icon outgoing" : "payment-direction-icon"}><Icon name={notificationIcon(item.type)} size={18} /></span>
                <span className="payment-history-main"><strong>{item.title}{!item.readAt ? " · New" : ""}</strong><span>{item.message}</span><small>{formatTime(item.createdAt)}</small></span>
                {!item.readAt && <Icon name="circle" size={10} /> }
              </button>
            ))}</div>}
      </section>
    </div>
  );
}