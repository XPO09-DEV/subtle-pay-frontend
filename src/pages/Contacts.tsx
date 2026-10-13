import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Icon from "../components/Icon";
import {
  deleteContact,
  getContacts,
  getPaymentHistory,
  saveContact,
  type BackendContact,
  type PaymentRecord,
} from "../services/accountService";
import { copyText } from "../services/walletService";
import "./Contacts.css";

type Section = "contacts" | "merchants";
type ContactRow = {
  key: string;
  address: string | null;
  alias: string | null;
  accountId: string | null;
  savedName: string | null;
  createdAt: number | null;
  directions: Set<"in" | "out">;
  isSaved: boolean;
  isMerchant: boolean;
  merchantName: string | null;
  lastPaymentAt: number;
};

const PAGE_SIZE = 100;
const ADDRESS_RE = /^0x[a-f0-9]{40}$/i;

function shortenAddress(value: string): string {
  return value.length > 18 ? value.slice(0, 8) + "…" + value.slice(-6) : value;
}

function contactKey(address: string | null, alias: string | null, accountId: string | null, fallback: string): string {
  if (address) return "address:" + address.toLowerCase();
  if (accountId) return "account:" + accountId.toLowerCase();
  if (alias) return "alias:" + alias.replace(/^@/, "").toLowerCase();
  return "label:" + fallback.trim().toLowerCase();
}

function mergeContacts(saved: BackendContact[], payments: PaymentRecord[]): ContactRow[] {
  const rows = new Map<string, ContactRow>();
  for (const contact of saved) {
    const address = contact.address?.trim() || null;
    const alias = contact.alias?.trim().replace(/^@/, "") || null;
    const key = contactKey(address, alias, contact.accountId, contact.name);
    const existing = rows.get(key);
    if (existing) {
      existing.isSaved = true;
      existing.savedName = contact.name;
      existing.createdAt = contact.createdAt ?? existing.createdAt;
      continue;
    }
    rows.set(key, {
      key, address, alias, accountId: contact.accountId ?? null,
      savedName: contact.name, createdAt: contact.createdAt ?? null,
      directions: new Set(), isSaved: true, isMerchant: false,
      merchantName: null, lastPaymentAt: 0,
    });
  }

  for (const payment of payments) {
    const rawCounterparty = payment.counterparty?.trim() ?? "";
    const address = payment.counterpartyAddress?.trim() || (ADDRESS_RE.test(rawCounterparty) ? rawCounterparty : null);
    const alias = payment.counterpartyAlias?.trim().replace(/^@/, "")
      || (!address && rawCounterparty ? rawCounterparty.replace(/^@/, "") : null);
    const key = contactKey(address, alias, null, rawCounterparty || payment.id);
    let row = rows.get(key);
    if (!row && address) {
      // A saved account ID can point at the same known wallet address.
      row = Array.from(rows.values()).find((candidate) => candidate.address?.toLowerCase() === address.toLowerCase());
    }
    if (!row) {
      row = {
        key, address, alias, accountId: null, savedName: null, createdAt: null,
        directions: new Set(), isSaved: false, isMerchant: false,
        merchantName: null, lastPaymentAt: 0,
      };
      rows.set(key, row);
    }
    row.address = address ?? row.address;
    row.alias = alias ?? row.alias;
    row.directions.add(payment.direction);
    const paymentTime = new Date(payment.createdAt).getTime();
    if (Number.isFinite(paymentTime) && paymentTime >= row.lastPaymentAt) {
      row.lastPaymentAt = paymentTime;
      row.merchantName = payment.counterpartyMerchantName ?? row.merchantName;
    }
    if (payment.direction === "out" && payment.status === "confirmed" && payment.counterpartyIsMerchant) {
      row.isMerchant = true;
      row.merchantName = payment.counterpartyMerchantName ?? row.merchantName;
    }
  }

  return Array.from(rows.values()).sort((a, b) => {
    if (a.lastPaymentAt !== b.lastPaymentAt) return b.lastPaymentAt - a.lastPaymentAt;
    return (a.savedName ?? a.alias ?? a.address ?? "").localeCompare(b.savedName ?? b.alias ?? b.address ?? "");
  });
}

function directionLabel(row: ContactRow): string {
  if (row.directions.has("in") && row.directions.has("out")) return "Incoming & outgoing";
  if (row.directions.has("in")) return "Incoming";
  if (row.directions.has("out")) return "Outgoing";
  return "Saved contact";
}

export default function Contacts({
  onSendToContact,
  onOpenMerchantCentre,
}: {
  onSendToContact: (recipient: string) => void;
  onOpenMerchantCentre: () => void;
}) {
  const [section, setSection] = useState<Section>("contacts");
  const [savedContacts, setSavedContacts] = useState<BackendContact[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [contactName, setContactName] = useState("");
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(true);
  const [moreBusy, setMoreBusy] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const loadData = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      const [contacts, history] = await Promise.all([
        getContacts(),
        getPaymentHistory({ limit: PAGE_SIZE }),
      ]);
      setSavedContacts(contacts);
      setPayments(history);
      setHasMore(history.length === PAGE_SIZE);
    } catch (cause) {
      setNotice({ kind: "error", message: cause instanceof Error ? cause.message : "Contacts could not be loaded." });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const rows = useMemo(() => mergeContacts(savedContacts, payments), [savedContacts, payments]);
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase().replace(/^@/, "");
    return rows.filter((row) => {
      const inSection = section === "contacts" || (row.isMerchant && row.directions.has("out"));
      if (!inSection) return false;
      if (!query) return true;
      return [row.savedName, row.alias, row.address, row.accountId, row.merchantName]
        .some((value) => value?.toLowerCase().includes(query));
    });
  }, [rows, search, section]);

  async function loadMore() {
    const oldest = payments[payments.length - 1];
    if (!oldest || moreBusy || !hasMore) return;
    const before = new Date(oldest.createdAt).getTime();
    if (!Number.isFinite(before)) {
      setNotice({ kind: "error", message: "Older history cannot be paged because its timestamp is invalid." });
      return;
    }
    setMoreBusy(true);
    try {
      const page = await getPaymentHistory({ limit: PAGE_SIZE, before, beforeId: oldest.id });
      setPayments((existing) => {
        const ids = new Set(existing.map((payment) => payment.id));
        return [...existing, ...page.filter((payment) => !ids.has(payment.id))];
      });
      setHasMore(page.length === PAGE_SIZE);
    } catch (cause) {
      setNotice({ kind: "error", message: cause instanceof Error ? cause.message : "Older payment history could not be loaded." });
    } finally {
      setMoreBusy(false);
    }
  }

  async function addContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (actionBusy) return;
    setActionBusy(true);
    setNotice(null);
    try {
      await saveContact({ name: contactName.trim(), recipient: recipient.trim() });
      setSavedContacts(await getContacts());
      setContactName("");
      setRecipient("");
      setShowAddForm(false);
      setNotice({ kind: "success", message: "Saved privately to your Subtle Pay contacts." });
    } catch (cause) {
      setNotice({ kind: "error", message: cause instanceof Error ? cause.message : "Contact could not be saved." });
    } finally {
      setActionBusy(false);
    }
  }

  async function removeSavedContact(name: string) {
    setActionBusy(true);
    setNotice(null);
    try {
      await deleteContact(name);
      setSavedContacts((current) => current.filter((contact) => contact.name !== name));
      setNotice({ kind: "success", message: "Saved label removed. Transaction addresses remain in your history." });
    } catch (cause) {
      setNotice({ kind: "error", message: cause instanceof Error ? cause.message : "Saved contact could not be removed." });
    } finally {
      setActionBusy(false);
    }
  }

  async function copyAddress(address: string) {
    try {
      await copyText(address);
      setNotice({ kind: "success", message: "Wallet address copied." });
    } catch {
      setNotice({ kind: "error", message: "Copy is unavailable in this browser." });
    }
  }

  function sendTo(row: ContactRow) {
    const value = row.address ?? row.alias ?? row.accountId ?? row.savedName;
    if (!value) {
      setNotice({ kind: "error", message: "This contact has no usable payment destination." });
      return;
    }
    onSendToContact(value);
  }

  const savedCount = rows.filter((row) => row.isSaved).length;
  const merchantCount = rows.filter((row) => row.isMerchant && row.directions.has("out")).length;

  return (
    <div className="page-stack inner-page contacts-page">
      <header className="contacts-header">
        <div>
          <span className="contacts-kicker">YOUR ADDRESS BOOK</span>
          <h1>Contacts</h1>
          <p>Your saved people and wallet addresses from incoming and outgoing payments.</p>
        </div>
        <button className="contacts-icon-button" type="button" onClick={() => void loadData()} disabled={busy} aria-label="Refresh contacts">
          <Icon name="refresh" size={18} />
        </button>
      </header>

      <div className="contacts-security-note">
        <Icon name="shield" size={18} />
        <div><strong>Private to your account</strong><p>Saved labels are visible only in your signed-in account. Addresses are matched from your own payment history; there is no public contact directory.</p></div>
      </div>

      {notice && <div className={notice.kind === "success" ? "contacts-notice success" : "contacts-notice error"} role="status">
        <Icon name={notice.kind === "success" ? "check-circle" : "info"} size={16} /><span>{notice.message}</span>
        <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message"><Icon name="close" size={14} /></button>
      </div>}

      <div className="contacts-toolbar">
        <div className="contacts-tabs" role="tablist" aria-label="Address book sections">
          <button type="button" className={section === "contacts" ? "active" : ""} onClick={() => setSection("contacts")} role="tab" aria-selected={section === "contacts"}>
            Contacts <span>{rows.length}</span>
          </button>
          <button type="button" className={section === "merchants" ? "active" : ""} onClick={() => setSection("merchants")} role="tab" aria-selected={section === "merchants"}>
            Merchants <span>{merchantCount}</span>
          </button>
        </div>
        {section === "contacts" && <button type="button" className="contacts-add-button" onClick={() => setShowAddForm((show) => !show)}>
          <Icon name={showAddForm ? "close" : "more"} size={16} /> {showAddForm ? "Close" : "Add contact"}
        </button>}
      </div>

      {section === "merchants" && <section className="merchant-directory-banner">
        <div className="merchant-directory-icon"><Icon name="merchant" size={21} /></div>
        <div className="merchant-directory-copy"><strong>Merchants you’ve paid</strong><p>Only confirmed outgoing payments to an enabled merchant profile appear here. Merchant labels and addresses come from your own payment history.</p></div>
        <button type="button" onClick={onOpenMerchantCentre}>Become a merchant <Icon name="arrow-right" size={15} /></button>
      </section>}

      {showAddForm && section === "contacts" && <form className="contacts-add-form" onSubmit={(event) => void addContact(event)}>
        <div className="contacts-form-heading"><strong>Add a contact</strong><span>Only you can see your saved label.</span></div>
        <label htmlFor="contact-label">Private name</label>
        <input id="contact-label" value={contactName} onChange={(event) => setContactName(event.target.value)} minLength={1} maxLength={32} required autoComplete="off" placeholder="e.g. Alex or Coffee shop" />
        <label htmlFor="contact-recipient">Subtle Pay handle, account ID or wallet address</label>
        <input id="contact-recipient" value={recipient} onChange={(event) => setRecipient(event.target.value)} maxLength={80} required autoComplete="off" spellCheck={false} placeholder="@handle or 0x… address" />
        <div className="contacts-form-actions"><button type="button" className="contacts-secondary-button" onClick={() => setShowAddForm(false)}>Cancel</button><button type="submit" className="contacts-primary-button" disabled={actionBusy}>{actionBusy ? "Saving…" : "Save contact"}</button></div>
      </form>}

      <form className="contacts-search" onSubmit={(event) => event.preventDefault()}>
        <Icon name="search" size={18} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={section === "contacts" ? "Search name, handle or wallet address" : "Search merchants"} aria-label="Search contacts" autoComplete="off" spellCheck={false} />
        {search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")}><Icon name="close" size={15} /></button>}
      </form>

      <section className="contacts-list" aria-label={section === "contacts" ? "Contacts list" : "Merchants paid"}>
        {busy ? <div className="contacts-empty"><span className="ta-search-spinner" /><strong>Loading your address book…</strong></div>
          : visibleRows.length === 0 ? <div className="contacts-empty">
            <span className="contacts-empty-icon"><Icon name={section === "contacts" ? "users" : "merchant"} size={22} /></span>
            <strong>{section === "contacts" ? "No contacts yet" : "No merchant payments yet"}</strong>
            <p>{section === "contacts" ? "Contacts you add and wallets from your incoming or outgoing payment history will appear here." : "When you complete a payment to an enabled Subtle Pay merchant, their wallet will appear here."}</p>
            {section === "contacts" && <button type="button" onClick={() => setShowAddForm(true)}>Add your first contact</button>}
            {section === "merchants" && <button type="button" onClick={onOpenMerchantCentre}>Become a merchant <Icon name="arrow-right" size={15} /></button>}
          </div> : visibleRows.map((row) => {
            const title = row.savedName ?? row.merchantName ?? (row.alias ? "@" + row.alias.replace(/^@/, "") : row.address ? shortenAddress(row.address) : row.accountId ?? "Wallet contact");
            const subtitle = row.address ?? (row.accountId ? "Subtle Pay account · " + row.accountId : row.alias ? "Subtle Pay handle" : "Address unavailable");
            return <article className="contacts-row" key={row.key}>
              <div className="contacts-avatar" aria-hidden="true">{(row.savedName ?? row.merchantName ?? row.alias ?? row.address ?? "?").replace(/^@/, "").slice(0, 1).toUpperCase()}</div>
              <div className="contacts-row-main">
                <div className="contacts-row-title">{title}{row.isMerchant && section === "contacts" && <span className="contacts-merchant-chip">Merchant</span>}{row.isSaved && <span className="contacts-private-chip">Saved</span>}</div>
                {row.alias && row.savedName && <div className="contacts-row-handle">@{row.alias.replace(/^@/, "")}</div>}
                <button className="contacts-address" type="button" title={row.address ?? undefined} onClick={() => row.address ? void copyAddress(row.address) : undefined} disabled={!row.address}>
                  <span>{subtitle}</span>{row.address && <Icon name="copy" size={14} />}
                </button>
                <div className="contacts-row-meta">{directionLabel(row)}{row.lastPaymentAt > 0 ? " · Last activity " + new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(row.lastPaymentAt) : ""}</div>
              </div>
              <div className="contacts-row-actions">
                <button type="button" className="contacts-pay-button" onClick={() => sendTo(row)} disabled={!row.address && !row.alias && !row.accountId} title="Prepare a payment to this contact"><Icon name="send" size={15} /><span>Pay</span></button>
                {row.isSaved && row.savedName && <button type="button" className="contacts-remove-button" disabled={actionBusy} onClick={() => void removeSavedContact(row.savedName!)} aria-label={"Remove saved label for " + title} title="Remove saved contact label"><Icon name="close" size={15} /></button>}
              </div>
            </article>;
          })}
      </section>

      {!busy && hasMore && <div className="contacts-load-more"><p>Showing contacts from the latest {payments.length} payment records.</p><button type="button" onClick={() => void loadMore()} disabled={moreBusy}>{moreBusy ? "Loading older payments…" : "Load older payment history"} <Icon name="arrow-down-left" size={15} /></button></div>}
      {!busy && !hasMore && payments.length > 0 && <p className="contacts-history-footnote">All available payment history has been checked for counterparties. Payment details stay private to your account.</p>}
      <div className="contacts-page-footer"><Icon name="lock" size={14} /><span>Payments still require the usual account authorization. Saving a contact never authorizes a transfer.</span></div>
    </div>
  );
}
