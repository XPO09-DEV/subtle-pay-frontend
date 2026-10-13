import { useEffect, useState, type FormEvent } from "react";
import Icon from "../components/Icon";
import { getPaymentHistory, type PaymentRecord } from "../services/accountService";

type StatusFilter = "all" | "pending" | "submitted" | "confirmed" | "failed";
type DirectionFilter = "all" | "in" | "out";

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function statusLabel(status: string): string {
  if (status === "confirmed") return "Confirmed";
  if (status === "failed") return "Failed";
  if (status === "submitted" || status === "pending") return "Pending";
  return status;
}
function short(value: string | null | undefined, left = 9, right = 7): string {
  if (!value) return "—";
  return value.length > left + right + 3 ? value.slice(0, left) + "…" + value.slice(-right) : value;
}
function statusClass(status: string): string {
  if (status === "confirmed") return "history-status confirmed";
  if (status === "failed") return "history-status failed";
  return "history-status pending";
}

export default function Activity() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const page = await getPaymentHistory({
        limit: 100,
        q: appliedQuery || undefined,
        status: status === "all" ? undefined : status,
        direction: direction === "all" ? undefined : direction,
      });
      setPayments(page);
      setUpdatedAt(Date.now());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Transaction history could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void refresh(); }, [appliedQuery, status, direction]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedQuery(query.trim());
  }
  function clearFilters() {
    setQuery("");
    setAppliedQuery("");
    setStatus("all");
    setDirection("all");
  }

  const confirmed = payments.filter((payment) => payment.status === "confirmed").length;
  const pending = payments.filter((payment) => payment.status === "submitted" || payment.status === "pending").length;
  const total = payments.length;
  const filtersActive = Boolean(appliedQuery || status !== "all" || direction !== "all");

  return (
    <div className="page-stack inner-page activity-page">
      <div className="page-intro">
        <div><div className="section-kicker">TRANSACTION CENTRE</div><h1>Activity</h1><p>Find payments, inspect status, and open verified Monad Testnet transactions.</p></div>
        <span className="page-icon-bubble"><Icon name="activity" size={20} /></span>
      </div>
      <section className="history-summary-grid" aria-label="Visible transaction summary">
        <article><span>Loaded transactions</span><strong>{busy ? "—" : total}</strong><small>Up to 100 matching records</small></article>
        <article><span>Confirmed</span><strong>{busy ? "—" : confirmed}</strong><small>Recorded as confirmed</small></article>
        <article><span>Awaiting finality</span><strong>{busy ? "—" : pending}</strong><small>Pending or submitted</small></article>
      </section>
      <section className="panel history-search-panel">
        <div className="panel-heading compact">
          <div><div className="section-kicker">SEARCH & FILTER</div><h2>Transaction history</h2></div>
          <button type="button" className="secondary-button" onClick={() => void refresh()} disabled={busy}><Icon name="refresh" size={15} /> Refresh</button>
        </div>
        <form className="history-search-form" onSubmit={search}>
          <label className="history-search-box">
            <Icon name="search" size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ID, recipient, note or transaction hash" aria-label="Search transaction history" />
            {query && <button type="button" className="history-search-clear" onClick={() => { setQuery(""); setAppliedQuery(""); }} aria-label="Clear search"><Icon name="close" size={14} /></button>}
          </label>
          <button type="submit" className="primary-button" disabled={busy}><Icon name="search" size={15} /> Search</button>
        </form>
        <div className="history-filter-row">
          <label><span>Direction</span><select value={direction} onChange={(event) => setDirection(event.target.value as DirectionFilter)}><option value="all">All payments</option><option value="out">Sent</option><option value="in">Received</option></select></label>
          <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}><option value="all">All statuses</option><option value="confirmed">Confirmed</option><option value="pending">Pending</option><option value="submitted">Submitted</option><option value="failed">Failed</option></select></label>
          {filtersActive && <button type="button" className="history-clear-filters" onClick={clearFilters}>Clear filters</button>}
        </div>
        {updatedAt !== null && !busy && <p className="history-updated">Updated {new Date(updatedAt).toLocaleTimeString()} · Results from your account history</p>}
      </section>
      {error && <div className="inline-notice" role="alert"><Icon name="info" size={16} /><span>{error}</span><button type="button" onClick={() => void refresh()} className="history-retry">Retry</button></div>}
      <section className="panel history-results-panel" aria-label="Transaction results">
        <div className="panel-heading compact history-results-heading"><div><div className="section-kicker">YOUR ACCOUNT</div><h2>{busy ? "Loading transactions…" : total === 1 ? "1 transaction" : \`\${total} transactions\`}</h2></div><span className="history-network-tag"><span /> Monad Testnet</span></div>
        {busy ? (
          <div className="history-loading"><span className="ta-search-spinner" /><strong>Fetching your transaction records</strong><small>Searching only payments associated with this account.</small></div>
        ) : !error && payments.length === 0 ? (
          <div className="history-empty"><span><Icon name="search" size={23} /></span><strong>{filtersActive ? "No matching transactions" : "No transactions yet"}</strong><p>{filtersActive ? "Try another search phrase or clear your filters." : "Your sent and received Subtle Pay payments will appear here after the backend records them."}</p>{filtersActive && <button type="button" className="secondary-button" onClick={clearFilters}>Clear filters</button>}</div>
        ) : (
          <div className="history-transaction-list">
            {payments.map((payment) => {
              const outgoing = payment.direction === "out";
              return (
                <article className="history-transaction-row" key={payment.id}>
                  <span className={outgoing ? "history-direction-icon outgoing" : "history-direction-icon incoming"}><Icon name={outgoing ? "arrow-up-right" : "arrow-down-left"} size={19} /></span>
                  <div className="history-transaction-main">
                    <div className="history-transaction-title"><strong>{outgoing ? "Sent payment" : "Received payment"}</strong><span className={statusClass(payment.status)}>{statusLabel(payment.status)}</span></div>
                    <p>{outgoing ? "To " : "From "}<b>{payment.counterparty || "External wallet"}</b></p>
                    {payment.note && <small className="history-transaction-note">{payment.note}</small>}
                    <small className="history-transaction-time">{formatTime(payment.createdAt)} · ID {short(payment.id, 8, 5)}</small>
                    {payment.txHash && <a className="history-explorer-link" href={\`https://testnet.monadexplorer.com/tx/\${encodeURIComponent(payment.txHash)}\`} target="_blank" rel="noreferrer"><Icon name="external-link" size={13} /> View on explorer <code>{short(payment.txHash, 10, 8)}</code></a>}
                  </div>
                  <div className="history-transaction-value">
                    <strong>{outgoing ? "−" : "+"}{payment.localValue} {payment.displayCurrency}</strong>
                    <small>≈ \${payment.usdValue} USD reference</small>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {!busy && !error && payments.length === 100 && <p className="history-limit-note">Showing the latest 100 matching records. Refine your search to find older activity.</p>}
      </section>
      <p className="history-disclaimer">Displayed statuses reflect backend transaction records. Pending transactions are not treated as confirmed until the backend observes confirmation.</p>
    </div>
  );
}
