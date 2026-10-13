import { useEffect, useMemo, useState } from "react";
import type { PageId } from "../components/BottomNav";
import Icon from "../components/Icon";
import WalletCard from "../components/WalletCard";
import MarketPulse from "../components/MarketPulse";
import type { WalletAsset, WalletStatus } from "../services/walletService";
import { getContacts, saveContact as saveBackendContact, type BackendContact } from "../services/accountService";

type SavedContact = { id: string; name: string; recipient: string; };
type ContactPickerRecord = { name?: string[]; tel?: string[]; };

function mapBackendContact(contact: BackendContact): SavedContact {
  return { id: contact.name, name: contact.name, recipient: contact.accountId ?? contact.address ?? "" };
}
function walletGreeting(displayName: string) {
  const name = displayName.trim();
  if (!name) return "Wallet 1";
  if (name.includes("@")) return name.toLowerCase();
  const firstName = name.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return firstName ? `${firstName}@monad` : "Wallet 1";
}
function normalizeRecipient(recipient: string) { return recipient.trim().toLowerCase(); }
function triggerDashboardHaptic(duration = 6) {
  try { if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(duration); }
  catch { /* Haptics are optional and never block wallet actions. */ }
}

export default function Dashboard({
  selectedToken, onTokenChange, onNavigate, onSendToContact, displayName, onDisplayNameChange,
  walletAddress, walletAssets, walletStatus, walletError, onConnectWallet, onCopyAddress, onRefreshWallet, onDisconnectWallet,
}: {
  selectedToken: string; onTokenChange: (token: string) => void; onNavigate: (page: PageId) => void;
  onSendToContact: (recipient: string) => void; displayName: string; onDisplayNameChange: (name: string) => void;
  walletAddress: string | null; walletAssets: WalletAsset[]; walletStatus: WalletStatus; walletError: string | null;
  onConnectWallet: () => void; onCopyAddress: () => void; onRefreshWallet: () => void; onDisconnectWallet: () => void;
}) {
  const [contacts, setContacts] = useState<SavedContact[]>([]);
  const [showNameEditor, setShowNameEditor] = useState(false);
  const [nameInput, setNameInput] = useState(displayName);
  const [showContacts, setShowContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactRecipient, setContactRecipient] = useState("");
  const [contactNotice, setContactNotice] = useState("");
  const [isImportingContacts, setIsImportingContacts] = useState(false);

  const quickActions: { page: PageId | "contacts"; label: string; icon: "send" | "receive" | "merchant" | "users" }[] = [
    { page: "send", label: "Send", icon: "send" }, { page: "receive", label: "Receive", icon: "receive" },
    { page: "merchant", label: "Merchant", icon: "merchant" }, { page: "contacts", label: "Contacts", icon: "users" },
  ];
  useEffect(() => {
    let alive = true;
    void getContacts().then((items) => { if (alive) setContacts(items.map(mapBackendContact)); })
      .catch(() => { if (alive) setContactNotice("Contacts could not be loaded from the account service. Retry after reconnecting."); });
    return () => { alive = false; };
  }, []);
  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((contact) => `${contact.name} ${contact.recipient}`.toLowerCase().includes(query));
  }, [contactSearch, contacts]);

  async function addContact(event: { preventDefault: () => void }) {
    event.preventDefault();
    const name = contactName.trim(); const recipient = contactRecipient.trim();
    if (!name || !recipient) { setContactNotice("Enter a name and a Subtle Pay handle, account ID or 0x wallet address."); return; }
    if (contacts.some((contact) => normalizeRecipient(contact.recipient) === normalizeRecipient(recipient))) {
      setContactNotice("That recipient is already in your contacts."); return;
    }
    try {
      const saved = await saveBackendContact({ name, recipient });
      setContacts((current) => [...current.filter((item) => item.name !== saved.name), mapBackendContact({ ...saved, createdAt: Date.now() })]);
      setContactName(""); setContactRecipient(""); setShowAddContact(false); setContactNotice("Contact saved to your Subtle Pay account.");
    } catch (error) { setContactNotice(error instanceof Error ? error.message : "Contact could not be saved. Check the identifier and retry."); }
  }

  async function importDeviceContacts() {
    const contactNavigator = navigator as Navigator & {
      contacts?: { select: (properties: string[], options?: { multiple?: boolean }) => Promise<ContactPickerRecord[]> };
    };
    if (!contactNavigator.contacts?.select) { setContactNotice("Device contact import is not supported in this browser. Choose Add contact instead."); return; }
    setIsImportingContacts(true); setContactNotice("");
    try {
      const selected = await contactNavigator.contacts.select(["name", "tel"], { multiple: true });
      const imported: Array<{ name: string; recipient: string }> = [];
      for (const item of selected) {
        const recipient = item.tel?.find((value) => /^0x[a-fA-F0-9]{40}$/.test(value.trim()) || /^[A-Z0-9]{20,40}$/i.test(value.trim()) || /^@?[a-z0-9][a-z0-9._-]{1,30}$/i.test(value.trim()))?.trim();
        if (!recipient) continue;
        imported.push({ name: item.name?.find((value) => value.trim())?.trim() || recipient, recipient });
      }
      let savedCount = 0;
      for (const item of imported) { try { await saveBackendContact(item); savedCount += 1; } catch { /* do not keep unsupported/duplicate records locally */ } }
      const latest = await getContacts(); setContacts(latest.map(mapBackendContact));
      setContactNotice(savedCount ? `${savedCount} contact${savedCount === 1 ? "" : "s"} saved to your account.` : "No valid Subtle Pay handles, account IDs or wallet addresses were found. Phone numbers alone cannot receive a Subtle Pay payment.");
    } catch { setContactNotice("Contact import was cancelled or unavailable. You can add a contact manually."); }
    finally { setIsImportingContacts(false); }
  }

  return (
    <div className="page-stack dashboard-page">
      <div className="page-intro wallet-greeting-intro">
        <h1 className="wallet-greeting">{walletGreeting(displayName)}</h1>
        <button type="button" className="wallet-name-edit" aria-label="Edit wallet display name" title="Edit wallet name" onClick={() => { triggerDashboardHaptic(); setNameInput(displayName); setShowNameEditor((open) => !open); }}><Icon name="settings" size={15} /></button>
      </div>
      {showNameEditor && <form className="wallet-name-editor" onSubmit={(event) => { event.preventDefault(); onDisplayNameChange(nameInput.trim()); setShowNameEditor(false); }}>
        <label htmlFor="wallet-display-name">Wallet display name</label>
        <input id="wallet-display-name" value={nameInput} onChange={(event) => setNameInput(event.target.value)} placeholder="Wallet 1 or display name" maxLength={80} autoComplete="nickname" />
        <p>Your display name is saved to the account profile. Leave it blank to use Wallet 1.</p>
        <div><button type="button" className="secondary-button" onClick={() => { setNameInput(""); onDisplayNameChange(""); setShowNameEditor(false); }}>Use Wallet 1</button><button type="submit" className="primary-button">Save name</button></div>
      </form>}
      <WalletCard selectedToken={selectedToken} onTokenChange={onTokenChange} walletAddress={walletAddress} walletAssets={walletAssets} walletStatus={walletStatus} walletError={walletError} onConnectWallet={onConnectWallet} onCopyAddress={onCopyAddress} onRefreshWallet={onRefreshWallet} onDisconnectWallet={onDisconnectWallet} />
      <section className="quick-actions-section" aria-label="Wallet actions"><div className="quick-action-grid">
        {quickActions.map((action) => <button className="quick-action" key={action.page} onClick={() => { triggerDashboardHaptic(); if (action.page === "contacts") setShowContacts(true); else onNavigate(action.page); }} type="button"><span className="quick-action-icon"><Icon name={action.icon} size={22} /></span><span className="quick-action-copy"><strong>{action.label}</strong></span></button>)}
      </div></section>

      {showContacts && <div className="contacts-modal-backdrop" role="presentation" onClick={() => setShowContacts(false)}><section className="contacts-section panel contacts-modal" aria-labelledby="contacts-heading" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="contacts-header"><div><div className="section-kicker">PAYMENTS</div><h2 id="contacts-heading">Contacts</h2><p>{contacts.length} saved {contacts.length === 1 ? "contact" : "contacts"}</p></div>
          <div className="contacts-header-actions"><button className="contacts-add-button" type="button" onClick={() => { triggerDashboardHaptic(); setShowAddContact((open) => !open); setContactNotice(""); }}><svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>{showAddContact ? "Close" : "Add contact"}</button><button className="contacts-close-button" type="button" onClick={() => setShowContacts(false)} aria-label="Close contacts"><Icon name="close" size={17} /></button></div>
        </div>
        <div className="contacts-toolbar"><label className="contacts-search"><Icon name="search" size={17} /><input aria-label="Search contacts" value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} placeholder="Search contacts" /></label><button className="contacts-import-button" type="button" disabled={isImportingContacts} onClick={importDeviceContacts}><Icon name="smartphone" size={16} />{isImportingContacts ? "Importing…" : "Import"}</button></div>
        {contactNotice && <p className="contacts-notice" role="status">{contactNotice}</p>}
        {showAddContact && <form className="contact-add-form" onSubmit={addContact}>
          <label className="contact-form-field"><span>Name</span><input className="text-input" value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Contact name" autoComplete="name" required /></label>
          <label className="contact-form-field"><span>Subtle Pay handle, account ID or wallet address</span><input className="text-input" value={contactRecipient} onChange={(event) => setContactRecipient(event.target.value)} placeholder="@handle, account ID or 0x address" autoComplete="off" required /></label>
          <button className="primary-button contact-save-button" type="submit">Save contact</button>
        </form>}
        {contacts.length === 0 ? <div className="contacts-empty"><span className="contacts-empty-icon"><Icon name="user" size={21} /></span><strong>No contacts yet</strong><span>Contacts sync with your Subtle Pay account. Phone numbers alone are not payment identifiers.</span></div>
          : filteredContacts.length === 0 ? <div className="contacts-empty compact"><strong>No matching contacts</strong><span>Try another name, handle, account ID or address.</span></div>
          : <div className="contacts-list">{filteredContacts.map((contact) => <article className="contact-row" key={contact.id}><span className="avatar-initials contact-avatar">{contact.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "•"}</span><span className="recipient-copy contact-copy"><strong>{contact.name}</strong><small>{contact.recipient}</small></span><button className="contact-send-button" type="button" onClick={() => { triggerDashboardHaptic(); onSendToContact(contact.recipient); }} aria-label={`Send to ${contact.name}`}><Icon name="send" size={15} /><span>Send</span></button></article>)}</div>}
      </section></div>}

      <MarketPulse />

      <section className="panel testnet-assets-note"><div className="panel-heading compact"><div><div className="section-kicker">NETWORK</div><h2>Monad Testnet only</h2></div><span className="status-pill neutral">10143</span></div><p>Balances and payments come from your Subtle Pay backend account. Only native testnet MON is spendable in this hackathon build; mainnet and other-chain transfers are disabled.</p></section>
      <div className="mobile-nav-spacer" />
    </div>
  );
}
