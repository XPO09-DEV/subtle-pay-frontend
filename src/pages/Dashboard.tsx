import { useEffect, useMemo, useState } from "react";
import type { PageId } from "../components/BottomNav";
import Icon from "../components/Icon";
import WalletCard from "../components/WalletCard";
import TokenAssetsWidget from "../components/TokenAssetsWidget";
import type { WalletAsset, WalletStatus } from "../services/walletService";
import { deleteSavedContact, getSavedContacts, saveSavedContact } from "../services/accountService";

type SavedContact = {
  id: string;
  name: string;
  recipient: string;
};

function walletGreeting(displayName: string) {
  const name = displayName.trim();
  if (!name) return "Wallet 1";
  if (name.includes("@")) return name.toLowerCase();
  const firstName = name.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return firstName ? `${firstName}@monad` : "Wallet 1";
}

function contactInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "•";
}

function normalizeRecipient(recipient: string) {
  return recipient.trim().toLowerCase();
}

function triggerDashboardHaptic(duration = 6) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(duration);
  } catch {
    // Haptics are optional and never block wallet actions.
  }
}

export default function Dashboard({
  selectedToken,
  onTokenChange,
  onNavigate,
  onSendToContact,
  displayName,
  onDisplayNameChange,
  walletAddress,
  walletAssets,
  walletStatus,
  walletError,
  onConnectWallet,
  onCopyAddress,
  onRefreshWallet,
  onDisconnectWallet,
}: {
  selectedToken: string;
  onTokenChange: (token: string) => void;
  onNavigate: (page: PageId) => void;
  onSendToContact: (recipient: string) => void;
  displayName: string;
  onDisplayNameChange: (name: string) => void;
  walletAddress: string | null;
  walletAssets: WalletAsset[];
  walletStatus: WalletStatus;
  walletError: string | null;
  onConnectWallet: () => void;
  onCopyAddress: () => void;
  onRefreshWallet: () => void;
  onDisconnectWallet: () => void;
}) {
  const [contacts, setContacts] = useState<SavedContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [showNameEditor, setShowNameEditor] = useState(false);
  const [nameInput, setNameInput] = useState(displayName);
  const [showContacts, setShowContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactRecipient, setContactRecipient] = useState("");
  const [contactNotice, setContactNotice] = useState("");

  const quickActions: { page: PageId | "contacts"; label: string; icon: "send" | "receive" | "merchant" | "users" }[] = [
    { page: "send", label: "Send", icon: "send" },
    { page: "receive", label: "Receive", icon: "receive" },
    { page: "merchant", label: "Merchant", icon: "merchant" },
    { page: "contacts", label: "Contacts", icon: "users" },
  ];

  useEffect(() => {
    let active = true;
    void getSavedContacts()
      .then((rows) => {
        if (!active) return;
        setContacts(rows.map((row) => ({
          id: row.name,
          name: row.name,
          recipient: row.accountId ?? row.address ?? "",
        })).filter((row) => row.recipient));
      })
      .catch((error: unknown) => {
        if (active) setContactNotice(error instanceof Error ? error.message : "Could not load saved contacts.");
      })
      .finally(() => { if (active) setContactsLoading(false); });
    return () => { active = false; };
  }, []);

  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((contact) =>
      `${contact.name} ${contact.recipient}`.toLowerCase().includes(query)
    );
  }, [contactSearch, contacts]);

  async function addContact(event: { preventDefault: () => void }) {
    event.preventDefault();
    const name = contactName.trim();
    const recipient = contactRecipient.trim();
    if (!name || !recipient) {
      setContactNotice("Enter a name and an account ID, @handle or 0x wallet address.");
      return;
    }
    if (contacts.some((contact) => normalizeRecipient(contact.recipient) === normalizeRecipient(recipient))) {
      setContactNotice("That recipient is already in your contacts.");
      return;
    }
    setContactNotice("");
    try {
      const saved = await saveSavedContact(name, recipient);
      const resolvedRecipient = saved.accountId ?? saved.address ?? "";
      if (!resolvedRecipient) throw new Error("The backend did not return a usable recipient.");
      setContacts((current) => [...current.filter((contact) => contact.name !== saved.name), {
        id: saved.name,
        name: saved.name,
        recipient: resolvedRecipient,
      }]);
      setContactName("");
      setContactRecipient("");
      setShowAddContact(false);
      setContactNotice("Contact saved to your Subtle Pay account.");
    } catch (error) {
      setContactNotice(error instanceof Error ? error.message : "Contact could not be saved.");
    }
  }

  async function removeContact(name: string) {
    setContactNotice("");
    try {
      await deleteSavedContact(name);
      setContacts((current) => current.filter((contact) => contact.name !== name));
      setContactNotice("Contact removed.");
    } catch (error) {
      setContactNotice(error instanceof Error ? error.message : "Contact could not be removed.");
    }
  }

  return (
    <div className="page-stack dashboard-page">
      <div className="page-intro wallet-greeting-intro">
        <h1 className="wallet-greeting">{walletGreeting(displayName)}</h1>
        <button type="button" className="wallet-name-edit" aria-label="Edit wallet display name" title="Edit wallet name" onClick={() => { triggerDashboardHaptic(); setNameInput(displayName); setShowNameEditor((open) => !open); }}>
          <Icon name="settings" size={15} />
        </button>
      </div>
      {showNameEditor && (
        <form className="wallet-name-editor" onSubmit={(event) => { event.preventDefault(); onDisplayNameChange(nameInput.trim()); setShowNameEditor(false); }}>
          <label htmlFor="wallet-display-name">Wallet display name</label>
          <input id="wallet-display-name" value={nameInput} onChange={(event) => setNameInput(event.target.value)} placeholder="Wallet 1 or Anirban Sarkar" maxLength={80} autoComplete="nickname" />
          <p>A name like “Anirban Sarkar” displays as anirban@monad. Leave it blank to use Wallet 1.</p>
          <div><button type="button" className="secondary-button" onClick={() => { setNameInput(""); onDisplayNameChange(""); setShowNameEditor(false); }}>Use Wallet 1</button><button type="submit" className="primary-button">Save name</button></div>
        </form>
      )}

      <WalletCard
        selectedToken={selectedToken}
        onTokenChange={onTokenChange}
        walletAddress={walletAddress}
        walletAssets={walletAssets}
        walletStatus={walletStatus}
        walletError={walletError}
        onConnectWallet={onConnectWallet}
        onCopyAddress={onCopyAddress}
        onRefreshWallet={onRefreshWallet}
        onDisconnectWallet={onDisconnectWallet}
      />

      <section className="quick-actions-section" aria-label="Wallet actions">
        <div className="quick-action-grid">
          {quickActions.map((action) => (
            <button className="quick-action" key={action.page} onClick={() => { triggerDashboardHaptic(); if (action.page === "contacts") setShowContacts(true); else onNavigate(action.page); }} type="button">
              <span className="quick-action-icon"><Icon name={action.icon} size={22} /></span>
              <span className="quick-action-copy"><strong>{action.label}</strong></span>
            </button>
          ))}
        </div>
      </section>

      {showContacts && <div className="contacts-modal-backdrop" role="presentation" onClick={() => setShowContacts(false)}><section className="contacts-section panel contacts-modal" aria-labelledby="contacts-heading" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="contacts-header">
          <div>
            <div className="section-kicker">PAYMENTS</div>
            <h2 id="contacts-heading">Contacts</h2>
            <p>{contacts.length} saved {contacts.length === 1 ? "contact" : "contacts"}</p>
          </div>
          <div className="contacts-header-actions"><button className="contacts-add-button" type="button" onClick={() => { triggerDashboardHaptic(); setShowAddContact((open) => !open); setContactNotice(""); }}>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            {showAddContact ? "Close" : "Add contact"}
          </button><button className="contacts-close-button" type="button" onClick={() => setShowContacts(false)} aria-label="Close contacts"><Icon name="close" size={17} /></button></div>
        </div>

        <div className="contacts-toolbar">
          <label className="contacts-search">
            <Icon name="search" size={17} />
            <input aria-label="Search contacts" value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} placeholder="Search contacts" />
          </label>
          <span className="tiny-note">Synced with your account</span>
        </div>

        {contactNotice && <p className="contacts-notice" role="status">{contactNotice}</p>}

        {showAddContact && (
          <form className="contact-add-form" onSubmit={addContact}>
            <label className="contact-form-field">
              <span>Name</span>
              <input className="text-input" value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Contact name" autoComplete="name" required />
            </label>
            <label className="contact-form-field">
              <span>Account ID, @handle or wallet address</span>
              <input className="text-input" value={contactRecipient} onChange={(event) => setContactRecipient(event.target.value)} placeholder="Account ID, @handle or 0x address" autoComplete="off" required />
            </label>
            <button className="primary-button contact-save-button" type="submit">Save contact</button>
          </form>
        )}

        {contactsLoading ? (
          <div className="contacts-empty"><strong>Loading contacts…</strong></div>
        ) : contacts.length === 0 ? (
          <div className="contacts-empty">
            <span className="contacts-empty-icon"><Icon name="user" size={21} /></span>
            <strong>No contacts yet</strong>
            <span>Add a Subtle Pay account ID, handle or wallet address. Contacts sync to your account.</span>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="contacts-empty compact">
            <strong>No matching contacts</strong>
            <span>Try another name, phone number or handle.</span>
          </div>
        ) : (
          <div className="contacts-list">
            {filteredContacts.map((contact) => (
              <article className="contact-row" key={contact.id}>
                <span className="avatar-initials contact-avatar">{contactInitials(contact.name)}</span>
                <span className="recipient-copy contact-copy">
                  <strong>{contact.name}</strong>
                  <small>{contact.recipient}</small>
                </span>
                <div className="button-row"><button className="contact-send-button" type="button" onClick={() => { triggerDashboardHaptic(); onSendToContact(contact.recipient); }} aria-label={`Send to ${contact.name}`}>
                  <Icon name="send" size={15} /><span>Send</span>
                </button><button className="contact-send-button" type="button" onClick={() => void removeContact(contact.name)} aria-label={`Remove ${contact.name}`}>Remove</button></div>
              </article>
            ))}
          </div>
        )}
      </section></div>}

      <TokenAssetsWidget
        visibleHeld={3}
        walletConnected={Boolean(walletAddress)}
        pinned={[]}
        onConnectWallet={onConnectWallet}
        holdings={walletAssets.map((asset) => ({
          id: asset.id,
          amount: asset.balance,
          symbol: asset.tokenSymbol,
          name: asset.tokenName,
          image: asset.thumbnail,
          price: asset.priceUsd,
          valueUsd: asset.balanceUsd,
          network: asset.chainLabel,
          contractAddress: asset.contractAddress,
          marketId: asset.contractAddress ? undefined : ({ eth: "ethereum", bsc: "binancecoin", polygon: "polygon-ecosystem-token", arbitrum: "arbitrum", optimism: "optimism", avalanche: "avalanche-2", monad: "monad" } as Record<string, string>)[asset.blockchain],
        }))}
      />
      <div className="mobile-nav-spacer" />
    </div>
  );
}
