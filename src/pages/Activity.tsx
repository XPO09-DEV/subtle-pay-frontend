import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Icon from "../components/Icon";
import { getPaymentHistory, type PaymentRecord } from "../services/accountService";
import "./Activity.css";

type StatusFilter = "all" | "pending" | "submitted" | "confirmed" | "failed";
type DirectionFilter = "all" | "in" | "out";
type AmountFilter = "all" | "under10" | "10to100" | "over100";

interface MonthOption { value: string; label: string; }

function makeMonthOptions(count = 13): MonthOption[] {
  const now = new Date();
  const options: MonthOption[] = [];
  for (let offset = 0; offset < count; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const value = String(date.getFullYear()) + "-" + String(date.getMonth() + 1).padStart(2, "0");
    options.push({ value, label: new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date) });
  }
  return options;
}

function monthBounds(value: string): { from?: number; to?: number } {
  if (!value) return {};
  const parts = value.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return {};
  return {
    from: new Date(year, month - 1, 1).getTime(),
    to: new Date(year, month, 1).getTime(),
  };
}

function monthKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "undated";
  return String(date.getFullYear()) + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

function monthHeading(key: string): string {
  if (key === "undated") return "Date unavailable";
  const parts = key.split("-");
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(
    new Date(Number(parts[0]), Number(parts[1]) - 1, 1),
  );
}

function shortAddress(value: string | null | undefined): string {
  if (!value) return "External wallet";
  if (/^0x[a-f0-9]{40}$/i.test(value)) return value.slice(0, 7) + "…" + value.slice(-5);
  return value;
}

function formatAmount(value: string, currency: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value + " " + currency;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return amount.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " " + currency;
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

function statusLabel(status: string): string {
  if (status === "confirmed") return "Confirmed";
  if (status === "failed") return "Failed";
  if (status === "submitted" || status === "pending") return "Pending";
  return status;
}

function statusClass(status: string): string {
  if (status === "confirmed") return "activity-status-confirmed";
  if (status === "failed") return "activity-status-failed";
  return "activity-status-pending";
}

function amountMatches(payment: PaymentRecord, filter: AmountFilter): boolean {
  if (filter === "all") return true;
  const amount = Number(payment.usdValue);
  if (!Number.isFinite(amount)) return false;
  if (filter === "under10") return amount < 10;
  if (filter === "10to100") return amount >= 10 && amount < 100;
  return amount >= 100;
}

function transactionLabel(payment: PaymentRecord): string {
  if (payment.note?.trim()) return payment.note.trim();
  return payment.direction === "out" ? "Sent payment" : "Received payment";
}
function gasSummary(payment: PaymentRecord): string | null {
  if (!payment.feePaidMon) return null;
  const units = payment.gasUsed ? Number(payment.gasUsed).toLocaleString() : "—";
  const gwei = payment.effectiveGasPriceWei ? Number(payment.effectiveGasPriceWei) / 1_000_000_000 : null;
  const price = gwei !== null && Number.isFinite(gwei) ? gwei.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—";
  return `Gas ${units} units · ${price} gwei · fee ${payment.feePaidMon} MON`;
}

export default function Activity() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [month, setMonth] = useState("");
  const [amountFilter, setAmountFilter] = useState<AmountFilter>("all");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const monthOptions = useMemo(() => makeMonthOptions(), []);

  const loadPayments = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const page = await getPaymentHistory({
        limit: 100,
        q: appliedQuery || undefined,
        status: status === "all" ? undefined : status,
        direction: direction === "all" ? undefined : direction,
        ...monthBounds(month),
      });
      setPayments(page);
      setUpdatedAt(Date.now());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Transaction history could not be loaded.");
    } finally {
      setBusy(false);
    }
  }, [appliedQuery, status, direction, month]);

  useEffect(() => { void loadPayments(); }, [loadPayments]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedQuery(query.trim());
  }

  function clearFilters() {
    setQuery("");
    setAppliedQuery("");
    setStatus("all");
    setDirection("all");
    setMonth("");
    setAmountFilter("all");
  }

  const visiblePayments = useMemo(
    () => payments.filter((payment) => amountMatches(payment, amountFilter)),
    [payments, amountFilter],
  );

  const groupedPayments = useMemo(() => {
    const groups = new Map<string, PaymentRecord[]>();
    visiblePayments.forEach((payment) => {
      const key = monthKey(payment.createdAt);
      const group = groups.get(key) ?? [];
      group.push(payment);
      groups.set(key, group);
    });
    return Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === "undated") return 1;
      if (b[0] === "undated") return -1;
      return b[0].localeCompare(a[0]);
    });
  }, [visiblePayments]);

  const filtersActive = Boolean(appliedQuery || status !== "all" || direction !== "all" || month || amountFilter !== "all");

  return (
    <main className="page-stack inner-page activity-page activity-minimal">
      <header className="activity-minimal-header">
        <div>
          <span className="activity-kicker">PAYMENTS</span>
          <h1>Activity</h1>
          <p>Search, filter and review your transfers.</p>
        </div>
        <button type="button" className="activity-refresh-button" aria-label="Refresh activity" onClick={() => void loadPayments()} disabled={busy}>
          <Icon name="refresh" size={17} />
        </button>
      </header>

      <section className="activity-search-panel" aria-label="Search transaction activity">
        <form className="activity-search-form" onSubmit={submitSearch}>
          <Icon name="search" size={19} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search wallet address, name, ID or transaction hash"
            aria-label="Search by wallet address, counterparty, transaction ID, or transaction hash"
            autoComplete="off"
            spellCheck={false}
          />
          {query && <button type="button" className="activity-search-clear" aria-label="Clear search" onClick={() => { setQuery(""); setAppliedQuery(""); }}>
            <Icon name="close" size={15} />
          </button>}
          <button type="submit" className="activity-search-submit" aria-label="Search activity" disabled={busy && query.trim() === appliedQuery}>
            <Icon name="arrow-up-right" size={17} />
          </button>
        </form>
        <p className="activity-search-help">Paste a wallet address to find transfers involving that address.</p>
      </section>

      <section className="activity-filters" aria-label="Activity filters">
        <label className="activity-filter-pill">
          <span className="sr-only">Status filter</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} aria-label="Filter by status">
            <option value="all">Status · All</option>
            <option value="confirmed">Status · Confirmed</option>
            <option value="pending">Status · Pending</option>
            <option value="submitted">Status · Submitted</option>
            <option value="failed">Status · Failed</option>
          </select>
          <Icon name="chevron-down" size={13} />
        </label>
        <label className="activity-filter-pill">
          <span className="sr-only">Flow filter</span>
          <select value={direction} onChange={(event) => setDirection(event.target.value as DirectionFilter)} aria-label="Filter by flow">
            <option value="all">Flow · All</option>
            <option value="out">Flow · Sent</option>
            <option value="in">Flow · Received</option>
          </select>
          <Icon name="chevron-down" size={13} />
        </label>
        <label className="activity-filter-pill">
          <span className="sr-only">Month filter</span>
          <select value={month} onChange={(event) => setMonth(event.target.value)} aria-label="Filter by month">
            <option value="">Date · All months</option>
            {monthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <Icon name="chevron-down" size={13} />
        </label>
        <label className="activity-filter-pill">
          <span className="sr-only">Amount filter (USD reference)</span>
          <select value={amountFilter} onChange={(event) => setAmountFilter(event.target.value as AmountFilter)} aria-label="Filter by USD reference amount">
            <option value="all">Amount · Any</option>
            <option value="under10">Amount · Under $10</option>
            <option value="10to100">Amount · $10–$100</option>
            <option value="over100">Amount · $100+</option>
          </select>
          <Icon name="chevron-down" size={13} />
        </label>
        {filtersActive && <button type="button" className="activity-clear-filters" onClick={clearFilters}>Clear</button>}
      </section>

      <section className="activity-results" aria-label="Transaction results" aria-busy={busy}>
        <div className="activity-results-topline">
          <span>{busy ? "Loading activity…" : visiblePayments.length + (visiblePayments.length === 1 ? " transaction" : " transactions")}</span>
          <span>{updatedAt && !busy ? "Updated " + new Date(updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Monad Testnet"}</span>
        </div>

        {error && <div className="activity-error" role="alert"><Icon name="info" size={16} /><span>{error}</span><button type="button" onClick={() => void loadPayments()}>Retry</button></div>}

        {busy ? (
          <div className="activity-loading" aria-live="polite">
            <span className="activity-loading-spinner" />
            <span>Fetching transactions</span>
          </div>
        ) : !error && visiblePayments.length === 0 ? (
          <div className="activity-empty">
            <span className="activity-empty-icon"><Icon name="search" size={21} /></span>
            <strong>{filtersActive ? "No matching activity" : "No transactions yet"}</strong>
            <p>{filtersActive ? "Try another search or clear the filters." : "Your sent and received transfers will appear here."}</p>
            {filtersActive && <button type="button" onClick={clearFilters}>Clear filters</button>}
          </div>
        ) : (
          <div className="activity-groups">
            {groupedPayments.map(([key, items]) => (
              <section className="activity-month-group" key={key} aria-label={monthHeading(key)}>
                <header className="activity-month-heading">
                  <h2>{monthHeading(key)}</h2>
                  <span>{items.length} {items.length === 1 ? "transaction" : "transactions"}</span>
                </header>
                <div className="activity-transaction-list">
                  {items.map((payment) => {
                    const outgoing = payment.direction === "out";
                    const counterparty = payment.counterparty || "External wallet";
                    const shortCounterparty = shortAddress(counterparty);
                    const pending = payment.status === "pending" || payment.status === "submitted";
                    const failed = payment.status === "failed";
                    return (
                      <article className="activity-transaction-row" key={payment.id}>
                        <span className={"activity-counterparty-avatar " + (outgoing ? "outgoing" : "incoming")} aria-hidden="true">
                          {/^0x[a-f0-9]{40}$/i.test(counterparty) ? <Icon name={outgoing ? "arrow-up-right" : "arrow-down-left"} size={19} /> : counterparty.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="activity-transaction-main">
                          <strong title={counterparty}>{shortCounterparty}</strong>
                          <span className="activity-transaction-meta">{formatDate(payment.createdAt)} · {outgoing ? "Sent" : "Received"}</span>
                          {payment.txHash && <a className="activity-transaction-link" href={"https://testnet.monadexplorer.com/tx/" + encodeURIComponent(payment.txHash)} target="_blank" rel="noreferrer">
                            View transaction <Icon name="arrow-up-right" size={12} />
                          </a>}
                          {gasSummary(payment) && <span className="activity-transaction-meta" title="Actual on-chain gas usage and network fee">{gasSummary(payment)}</span>}
                        </div>
                        <div className="activity-transaction-amount">
                          <strong className={failed ? "failed" : outgoing ? "outgoing" : "incoming"}>{outgoing ? "−" : "+"}{formatAmount(payment.localValue, payment.displayCurrency)}</strong>
                          {failed || pending ? <span className={"activity-status-label " + statusClass(payment.status)}>{statusLabel(payment.status)}</span> : <span className="activity-transaction-description">{transactionLabel(payment)}</span>}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
        {!busy && !error && payments.length === 100 && <p className="activity-limit-note">Showing up to 100 matching transactions. Narrow the search or choose a month to find older activity.</p>}
      </section>
    </main>
  );
}
