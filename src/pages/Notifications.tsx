import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "../components/Icon";
import { getPaymentHistory, type PaymentRecord } from "../services/accountService";
import { productAnnouncements, type ProductAnnouncement } from "../data/announcements";
import "./Notifications.css";

type NotificationKind = "payment" | "product" | "security";
type Filter = "all" | "payments" | "updates";
type NoticeStatus = "confirmed" | "pending" | "submitted" | "failed";

type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  createdAt: string;
  createdAtMs: number;
  status?: NoticeStatus;
  statusLabel?: string;
  amountLabel?: string;
  txHash?: string | null;
  tag: string;
};

function safeTime(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function formatFullTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function dayGroup(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Earlier";
  const now = new Date();
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const itemDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (itemDay === day) return "Today";
  if (itemDay === day - 86_400_000) return "Yesterday";
  return "Earlier";
}

function shortCounterparty(value: string | null | undefined): string {
  if (!value) return "an external wallet";
  if (/^0x[a-f0-9]{40}$/i.test(value)) return value.slice(0, 7) + "…" + value.slice(-5);
  return value.length > 44 ? value.slice(0, 23) + "…" + value.slice(-12) : value;
}

function formatAmount(value: string, currency: string, direction: "in" | "out"): string | undefined {
  if (!value || !currency) return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  try {
    const formatted = new Intl.NumberFormat(undefined, {
      style: "currency", currency, maximumFractionDigits: 2,
    }).format(Math.abs(numeric));
    return (direction === "out" ? "−" : "+") + formatted;
  } catch {
    return (direction === "out" ? "−" : "+") + Math.abs(numeric).toLocaleString(undefined, { maximumFractionDigits: 2 }) + " " + currency;
  }
}

function paymentNotification(payment: PaymentRecord): NotificationItem {
  const status = String(payment.status).toLowerCase() as NoticeStatus;
  const failed = status === "failed";
  const confirmed = status === "confirmed";
  const outgoing = payment.direction === "out";
  const counterparty = shortCounterparty(payment.counterparty);
  const title = failed
    ? "Payment failed"
    : confirmed
      ? outgoing ? "Payment sent successfully" : "Payment received"
      : outgoing ? "Payment submitted" : "Incoming payment update";
  const statusLabel = failed ? "Failed" : confirmed ? "Confirmed" : status === "pending" ? "Pending" : "Submitted";
  const notes: string[] = [];
  notes.push((outgoing ? "To " : "From ") + counterparty);
  if (payment.note?.trim()) notes.push(payment.note.trim());
  const date = String(payment.createdAt ?? "");
  return {
    id: "payment:" + payment.id + ":" + status,
    kind: "payment",
    title,
    description: notes.join(" · "),
    createdAt: date,
    createdAtMs: safeTime(date),
    status: status === "failed" || status === "confirmed" || status === "submitted" || status === "pending" ? status : "pending",
    statusLabel,
    amountLabel: formatAmount(payment.localValue, payment.displayCurrency, payment.direction),
    txHash: payment.txHash,
    tag: "Payment",
  };
}

function announcementNotification(announcement: ProductAnnouncement): NotificationItem {
  return {
    id: "announcement:" + announcement.id,
    kind: announcement.category,
    title: announcement.title,
    description: announcement.message,
    createdAt: announcement.publishedAt,
    createdAtMs: safeTime(announcement.publishedAt),
    tag: announcement.tag,
  };
}

function readStorage(key: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((item): item is string => typeof item === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function statusIcon(item: NotificationItem): "check-circle" | "alert" | "clock" | "bell" | "info" {
  if (item.kind === "product") return "info";
  if (item.kind === "security") return "bell";
  if (item.status === "confirmed") return "check-circle";
  if (item.status === "failed") return "alert";
  return "clock";
}

function unreadLabel(count: number): string {
  return count === 1 ? "1 unread notification" : count + " unread notifications";
}

export default function Notifications({ accountId }: { accountId: string }) {
  const storageKey = "subtlePayNotificationRead:" + accountId;
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(() => readStorage(storageKey));
  const firstLoad = useRef(true);

  const refresh = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const result = await getPaymentHistory({ limit: 50 });
      setPayments(result);
      setUpdatedAt(Date.now());
      if (firstLoad.current) {
        firstLoad.current = false;
        try {
          const alreadyInitialized = window.localStorage.getItem(storageKey) !== null;
          if (!alreadyInitialized) {
            // Existing payment history is the baseline on first visit; later payments/status changes start unread.
            const baseline = new Set(result.map((payment) => "payment:" + payment.id + ":" + String(payment.status).toLowerCase()));
            setReadIds(baseline);
            window.localStorage.setItem(storageKey, JSON.stringify([...baseline]));
          }
        } catch {
          // Read state is a convenience; notification data must still render if storage is unavailable.
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Notifications could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storageKey]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh(true);
    }, 45_000);
    const onVisible = () => {
      if (!document.hidden) void refresh(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const items = useMemo(() => [
    ...payments.map(paymentNotification),
    ...productAnnouncements.map(announcementNotification),
  ].sort((a, b) => b.createdAtMs - a.createdAtMs), [payments]);

  const unreadCount = items.filter((item) => !readIds.has(item.id)).length;
  const paymentCount = items.filter((item) => item.kind === "payment").length;
  const updateCount = items.filter((item) => item.kind !== "payment").length;

  const visibleItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "payments" && item.kind !== "payment") return false;
      if (filter === "updates" && item.kind === "payment") return false;
      if (unreadOnly && readIds.has(item.id)) return false;
      if (term && !(item.title + " " + item.description + " " + item.tag + " " + (item.txHash ?? "")).toLowerCase().includes(term)) return false;
      return true;
    });
  }, [items, filter, unreadOnly, readIds, query]);

  const groupedItems = useMemo(() => {
    const groups: Array<{ label: string; items: NotificationItem[] }> = [];
    for (const item of visibleItems) {
      const label = dayGroup(item.createdAt);
      const last = groups[groups.length - 1];
      if (last?.label === label) last.items.push(item);
      else groups.push({ label, items: [item] });
    }
    return groups;
  }, [visibleItems]);

  function persistReadIds(next: Set<string>) {
    setReadIds(next);
    try { window.localStorage.setItem(storageKey, JSON.stringify([...next].slice(-500))); }
    catch { /* Notifications remain usable when storage is disabled. */ }
  }

  function markRead(id: string) {
    if (readIds.has(id)) return;
    const next = new Set(readIds);
    next.add(id);
    persistReadIds(next);
  }

  function markAllRead() {
    const next = new Set(readIds);
    items.forEach((item) => next.add(item.id));
    persistReadIds(next);
  }

  return (
    <div className="page-stack inner-page notification-center">
      <header className="notification-center-header">
        <div className="notification-center-heading-copy">
          <span className="notification-center-kicker">YOUR INBOX</span>
          <h1>Notification Centre</h1>
          <p>Payment activity, account updates and what’s new at Subtle Pay.</p>
        </div>
        <div className="notification-center-header-actions">
          <button className="notification-center-icon-button" type="button" onClick={() => void refresh()} disabled={loading || refreshing} aria-label="Refresh notifications" title="Refresh">
            <Icon name="refresh" size={17} />
          </button>
          <span className="notification-center-bell" aria-hidden="true">
            <Icon name="bell" size={21} />
            {unreadCount > 0 && <i />}
          </span>
        </div>
      </header>

      <section className="notification-center-overview" aria-label="Notification summary">
        <div className="notification-center-overview-icon"><Icon name="bell" size={19} /></div>
        <div className="notification-center-overview-copy">
          <strong>{unreadCount ? unreadLabel(unreadCount) : "You’re all caught up"}</strong>
          <span>{updatedAt ? "Last synced at " + new Date(updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Payment updates sync from your account activity."}</span>
        </div>
        <button type="button" className="notification-center-mark-all" onClick={markAllRead} disabled={visibleItems.every((item) => readIds.has(item.id)) || visibleItems.length === 0}>
          <Icon name="check" size={15} />
          Mark all read
        </button>
      </section>

      <section className="notification-center-toolbar" aria-label="Filter notifications">
        <div className="notification-center-tabs" role="tablist" aria-label="Notification category">
          <button type="button" role="tab" aria-selected={filter === "all"} className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
            All <span>{items.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={filter === "payments"} className={filter === "payments" ? "active" : ""} onClick={() => setFilter("payments")}>
            Payments <span>{paymentCount}</span>
          </button>
          <button type="button" role="tab" aria-selected={filter === "updates"} className={filter === "updates" ? "active" : ""} onClick={() => setFilter("updates")}>
            Updates <span>{updateCount}</span>
          </button>
        </div>
        <div className="notification-center-tools-right">
          <button type="button" className={unreadOnly ? "notification-center-unread-filter active" : "notification-center-unread-filter"} aria-pressed={unreadOnly} onClick={() => setUnreadOnly((value) => !value)}>
            <span className="notification-center-filter-dot" />Unread
          </button>
          <label className="notification-center-search">
            <Icon name="search" size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search inbox" aria-label="Search notifications" />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><Icon name="close" size={13} /></button>}
          </label>
        </div>
      </section>

      {error && (
        <div className="notification-center-error" role="alert">
          <Icon name="alert" size={17} />
          <div><strong>Couldn’t sync notifications</strong><span>{error}</span></div>
          <button type="button" onClick={() => void refresh()} disabled={loading || refreshing}>Retry</button>
        </div>
      )}

      {loading ? (
        <section className="notification-center-list" aria-label="Loading notifications" aria-busy="true">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="notification-center-skeleton" key={index}>
              <span /><div><i /><i /></div><b />
            </div>
          ))}
        </section>
      ) : visibleItems.length === 0 ? (
        <section className="notification-center-empty">
          <span className="notification-center-empty-icon"><Icon name={query || unreadOnly ? "search" : "bell"} size={24} /></span>
          <h2>{query || unreadOnly ? "No matching notifications" : filter === "payments" ? "No payment activity yet" : filter === "updates" ? "No updates right now" : "You’re all caught up"}</h2>
          <p>{query || unreadOnly ? "Try another search or turn off the unread filter." : filter === "payments" ? "Sent, received and status updates will appear here as your account records them." : filter === "updates" ? "Product releases and important service notices will appear here." : "New payment activity and Subtle Pay updates will show up here."}</p>
          {(query || unreadOnly) && <button type="button" className="notification-center-reset" onClick={() => { setQuery(""); setUnreadOnly(false); }}>Clear filters</button>}
        </section>
      ) : (
        <div className="notification-center-groups" aria-label="Notifications">
          {groupedItems.map((group) => (
            <section key={group.label} className="notification-center-day-group" aria-label={group.label}>
              <div className="notification-center-day-heading"><h2>{group.label}</h2><span>{group.items.length}</span></div>
              <div className="notification-center-list">
                {group.items.map((item) => {
                  const unread = !readIds.has(item.id);
                  return (
                    <article className={"notification-center-item" + (unread ? " unread" : "")} key={item.id}>
                      <span className={"notification-center-item-icon " + item.kind + (item.status ? " " + item.status : "")} aria-hidden="true">
                        <Icon name={statusIcon(item)} size={18} />
                      </span>
                      <div className="notification-center-item-copy">
                        <div className="notification-center-item-topline">
                          <strong>{item.title}</strong>
                          {unread && <span className="notification-center-new-label">NEW</span>}
                        </div>
                        <p>{item.description}</p>
                        <div className="notification-center-item-meta">
                          <span className={"notification-center-category " + item.kind}>{item.tag}</span>
                          <time dateTime={item.createdAt} title={formatFullTime(item.createdAt)}>{formatTime(item.createdAt)}</time>
                          {item.statusLabel && <span className={"notification-center-status " + item.status}>{item.statusLabel}</span>}
                          {item.txHash && <a href={"https://testnet.monadexplorer.com/tx/" + encodeURIComponent(item.txHash)} target="_blank" rel="noreferrer" onClick={() => markRead(item.id)}>View transaction <Icon name="arrow-up-right" size={12} /></a>}
                        </div>
                      </div>
                      <div className="notification-center-item-side">
                        {item.amountLabel && <strong className={"notification-center-amount" + (item.amountLabel.startsWith("−") ? " outgoing" : " incoming")}>{item.amountLabel}</strong>}
                        <time dateTime={item.createdAt} title={formatFullTime(item.createdAt)}>{new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time>
                        {unread && <button type="button" className="notification-center-mark-read" onClick={() => markRead(item.id)} aria-label={"Mark " + item.title + " as read"} title="Mark as read"><Icon name="check" size={14} /></button>}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <footer className="notification-center-footer">
        <Icon name="shield" size={14} />
        <span>Payment notices reflect activity recorded by Subtle Pay. Transaction status can change; verify on the Monad Testnet Explorer before treating a transfer as final.</span>
      </footer>
    </div>
  );
}
