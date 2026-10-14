import { useEffect, useState, type FormEvent } from "react";
import Icon from "../components/Icon";
import type { AccountProfile } from "../services/accountService";
import {
  applyForMerchantAutopay,
  changeAccountPassword,
  deleteAccount,
  enableMerchantProfile,
  getAccountLoginHistory,
  getAccountProfile,
  getAccountSessions,
  getMerchantAutopayApplications,
  getMerchantProfile,
  getMpinStatus,
  getPasskeys,
  isPasskeySupported,
  registerPasskey,
  removePasskey,
  type PasskeyCredential,
  loginAccount,
  removeAccountMpin,
  revokeAccountSession,
  setAccountMpin,
  switchSavedAccount,
  updateAccountCurrency,
  updateAccountProfile,
  type ActiveAccountSession,
  type LoginHistoryEvent,
  type MerchantAutopayApplication,
  type MerchantProfile,
} from "../services/accountService";
import { getSupportedCurrencies, getSupportedCountries, updateAccountAlias } from "../services/accountService";
import "./More.css";
import { CURRENCIES } from "../data/currencies";

type MoreProps = {
  accountId?: string;
  walletAddress?: string | null;
  profile?: AccountProfile | null;
  onLogout: () => void;
  onAccountSwitched?: (profile: AccountProfile) => void;
  onProfileUpdated?: (profile: AccountProfile) => void;
  onOpenMerchantCentre?: () => void;
};
type Notice = { kind: "success" | "error"; text: string };
type SettingsSection = "profile" | "accounts" | "security" | "passkeys" | "sessions" | "history" | "currency" | "merchant" | "delete";
type SettingsCategory = "account" | "security" | "preferences" | "merchant" | "actions";
const SAVED_ACCOUNTS_KEY = "subtlepay.saved.account-ids.v1";

function normalizeAccountIdForUi(value: string): string {
  return value.trim().toUpperCase().replace(/[\\s-]/g, "");
}
function readSavedAccounts(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SAVED_ACCOUNTS_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((value): value is string => typeof value === "string")
          .map(normalizeAccountIdForUi).filter((value) => value.length === 27))].slice(0, 10)
      : [];
  } catch { return []; }
}
function saveIds(ids: string[]) {
  try { window.localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify([...new Set(ids)].slice(0, 10))); } catch { /* optional device preference */ }
}
function time(value: number | null | undefined): string {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
}
function shortAddress(value: string | null | undefined): string {
  return value ? value.slice(0, 10) + "…" + value.slice(-8) : "Wallet unavailable";
}

function pixelAvatarUrl(name: string, account: string): string {
  const seedText = (account + ":" + name.trim().toLowerCase()).slice(0, 180);
  let seed = 2166136261;
  for (let i = 0; i < seedText.length; i++) seed = Math.imul(seed ^ seedText.charCodeAt(i), 16777619) >>> 0;
  const palette = ["#ef8354", "#6c63ff", "#24a19c", "#d94f70", "#ba8b45", "#3e7cb1", "#9a6dd7"];
  const background = palette[seed % palette.length];
  const hair = ["#1d2433", "#38251d", "#f4c95d", "#7b3f26", "#e8e8e8"][(seed >>> 5) % 5];
  const skin = ["#f5c8a5", "#df9b73", "#9b6246", "#f1d3ba"][(seed >>> 9) % 4];
  const shirt = palette[(seed >>> 13) % palette.length];
  const cells: string[] = [];
  const put = (x:number,y:number,color:string) => cells.push('<rect x="'+x+'" y="'+y+'" width="1" height="1" fill="'+color+'"/>');
  for(let x=0;x<8;x++){put(x,0,background);put(x,7,background);}
  for(let y=1;y<7;y++){put(0,y,background);put(7,y,background);}
  [2,3,4,5].forEach(x=>put(x,1,hair));
  [1,2,3,4,5,6].forEach(x=>put(x,2,hair));
  [1,6].forEach(x=>put(x,3,hair));
  [2,3,4,5].forEach(x=>put(x,3,skin));
  [2,5].forEach(x=>put(x,4,hair));
  [3,4].forEach(x=>put(x,4,skin));
  [3,4].forEach(x=>put(x,5,skin));
  [2,5].forEach(x=>put(x,5,shirt));
  [1,2,3,4,5,6].forEach(x=>put(x,6,shirt));
  put(2,3,"#202431"); put(5,3,"#202431");
  put(3,4,"#ffffff");
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" shape-rendering="crispEdges">'+cells.join("")+'</svg>';
  return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
}

export default function More({
  accountId = "", walletAddress = null, profile = null, onLogout, onAccountSwitched, onProfileUpdated, onOpenMerchantCentre,
}: MoreProps) {
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [country, setCountry] = useState(profile?.country ?? "");
  const [countries, setCountries] = useState<Array<{ code: string; name: string }>>([]);
  const [aliasName, setAliasName] = useState(profile?.alias ?? "");
  const [aliasPassword, setAliasPassword] = useState("");
  const [currency, setCurrency] = useState(profile?.currency ?? "USD");
  const [currencyPassword, setCurrencyPassword] = useState("");
  const [currencies, setCurrencies] = useState<string[]>(["USD", "INR"]);
  const [savedIds, setSavedIds] = useState<string[]>(readSavedAccounts);
  const [newAccountId, setNewAccountId] = useState("");
  const [switchPassword, setSwitchPassword] = useState("");
  const [switchingId, setSwitchingId] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [mpinPassword, setMpinPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pin, setPin] = useState("");
  const [mpinEnabled, setMpinEnabled] = useState(false);
  const [sessions, setSessions] = useState<ActiveAccountSession[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEvent[]>([]);
  const [merchant, setMerchant] = useState<MerchantProfile | null>(null);
  const [merchantEnabled, setMerchantEnabled] = useState(false);
  const [merchantName, setMerchantName] = useState(profile?.displayName ?? "");
  const [merchantCategory, setMerchantCategory] = useState("individual");
  const [autopayReason, setAutopayReason] = useState("");
  const [applications, setApplications] = useState<MerchantAutopayApplication[]>([]);
  const [passkeys, setPasskeys] = useState<PasskeyCredential[]>([]);
  const [passkeyPassword, setPasskeyPassword] = useState("");
  const [passkeyDeviceName, setPasskeyDeviceName] = useState("This device");
  const [removingPasskeyId, setRemovingPasskeyId] = useState("");
  const [removePasskeyPassword, setRemovePasskeyPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSection | null>(null);
  const [expandedSettingsCategory, setExpandedSettingsCategory] = useState<SettingsCategory | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  useEffect(() => { setDisplayName(profile?.displayName ?? ""); setCountry(profile?.country ?? ""); setAliasName(profile?.alias ?? ""); setCurrency(profile?.currency ?? "USD"); setMerchantName(profile?.displayName ?? ""); }, [profile?.displayName, profile?.country, profile?.alias, profile?.currency]);
  useEffect(() => {
    const ids = [...new Set([...savedIds, ...(accountId ? [accountId] : [])])].slice(0, 10);
    setSavedIds(ids);
    saveIds(ids);
  // The active id is a device preference; no passwords are stored here.
  }, [accountId]);
  useEffect(() => {
    let alive = true;
    void getSupportedCurrencies().then((items) => { if (alive && items.length) setCurrencies(CURRENCIES.filter((option) => items.includes(option.code.toUpperCase())).map((option) => option.code.toUpperCase())); }).catch(() => undefined);
    void getSupportedCountries().then((items) => { if (alive && items.length) setCountries(items); }).catch(() => undefined);
    void getMpinStatus().then((value) => { if (alive) setMpinEnabled(value.enabled); }).catch(() => undefined);
    void getPasskeys().then((items) => { if (alive) setPasskeys(items); }).catch(() => undefined);
    void getAccountSessions().then((items) => { if (alive) setSessions(items); }).catch(() => undefined);
    void getAccountLoginHistory(20).then((items) => { if (alive) setLoginHistory(items); }).catch(() => undefined);
    void getMerchantProfile().then((value) => { if (alive) { setMerchantEnabled(value.enabled); setMerchant(value.profile); } }).catch(() => undefined);
    void getMerchantAutopayApplications().then((items) => { if (alive) setApplications(items); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  function report(kind: Notice["kind"], text: string) { setNotice({ kind, text }); }
  function toggleSettingsCategory(category: SettingsCategory) {
    setExpandedSettingsCategory((current) => {
      const next = current === category ? null : category;
      setActiveSettingsSection(null);
      return next;
    });
  }
  function toggleSettingsSection(section: SettingsSection, category: SettingsCategory) {
    setExpandedSettingsCategory(category);
    setActiveSettingsSection((current) => current === section ? null : section);
  }
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("profile"); setNotice(null);
    try {
      await updateAccountProfile({ displayName: displayName.trim() || null, country: country || null });
      const next = await getAccountProfile();
      setDisplayName(next.displayName ?? ""); setCountry(next.country ?? ""); setAliasName(next.alias ?? "");
      onProfileUpdated?.(next);
      report("success", next.alias ? `Profile saved. Your permanent handle is ${next.alias}@monad.` : "Profile saved.");
    } catch (cause) { report("error", cause instanceof Error ? cause.message : "Profile could not be saved."); }
    finally { setBusy(""); }
  }
  async function saveCurrency(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currencyPassword) { report("error", "Enter your account password to confirm this currency change."); return; }
    setBusy("currency"); setNotice(null);
    try {
      await updateAccountCurrency(currency, currencyPassword);
      setCurrencyPassword("");
      const next = await getAccountProfile();
      onProfileUpdated?.(next);
      report("success", "Display currency preference updated after password confirmation.");
    } catch (cause) { report("error", cause instanceof Error ? cause.message : "Currency could not be updated."); }
    finally { setBusy(""); }
  }
  function addSavedAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = normalizeAccountIdForUi(newAccountId);
    if (id.length !== 27) { report("error", "Enter a complete 27-character Subtle Pay account ID."); return; }
    if (savedIds.includes(id)) { report("error", "That account is already saved on this device."); return; }
    const next = [...savedIds, id].slice(-10);
    setSavedIds(next); saveIds(next); setNewAccountId("");
    report("success", "Account ID saved on this device. Its password is not stored.");
  }
  async function switchSavedAccountOnDevice(id: string) {
    setBusy("switch:" + id); setNotice(null);
    try {
      const switched = await switchSavedAccount(id);
      if (!switched) {
        setSwitchingId(id);
        setSwitchPassword("");
        report("error", "This device has no active saved session for that account. Enter its password once to sign in and save a protected session.");
        return;
      }
      const next = await getAccountProfile();
      const nextIds = [...new Set([...savedIds, accountId, next.accountId].filter(Boolean))].slice(-10);
      setSavedIds(nextIds); saveIds(nextIds);
      setSwitchPassword(""); setSwitchingId("");
      onAccountSwitched?.(next);
      report("success", "Saved account switched securely. Review the active wallet before paying.");
    } catch (cause) { report("error", cause instanceof Error ? cause.message : "Could not switch saved accounts."); }
    finally { setBusy(""); }
  }

  async function switchAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = normalizeAccountIdForUi(switchingId);
    if (!switchPassword) { report("error", "Enter the password for this account to switch."); return; }
    setBusy("switch:" + id); setNotice(null);
    try {
      // Logging into the target account rotates the browser's single active
      // refresh cookie. Never store account passwords in localStorage.
      await loginAccount(id, switchPassword);
      const next = await getAccountProfile();
      const nextIds = [...new Set([...savedIds, accountId, next.accountId].filter(Boolean))].slice(-10);
      setSavedIds(nextIds); saveIds(nextIds);
      setSwitchPassword(""); setSwitchingId("");
      onAccountSwitched?.(next);
      report("success", "Account switched. Review the active wallet before initiating a payment.");
    } catch (cause) { report("error", cause instanceof Error ? cause.message : "Could not switch accounts."); }
    finally { setBusy(""); }
  }
  async function saveMpin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pin.length !== 6) { report("error", "MPIN must contain exactly six digits."); return; }
    setBusy("mpin"); setNotice(null);
    try {
      await setAccountMpin(mpinPassword, pin);
      setMpinEnabled(true); setMpinPassword(""); setPin("");
      report("success", "MPIN enabled. You can use it to authorize payments.");
    } catch (cause) { report("error", cause instanceof Error ? cause.message : "MPIN could not be saved."); }
    finally { setBusy(""); }
  }
  async function disableMpin() {
    setBusy("mpin"); setNotice(null);
    try {
      await removeAccountMpin(mpinPassword);
      setMpinEnabled(false); setMpinPassword(""); setPin("");
      report("success", "MPIN disabled. Payment authorization will require your account password.");
    } catch (cause) { report("error", cause instanceof Error ? cause.message : "MPIN could not be disabled."); }
    finally { setBusy(""); }
  }
  async function saveAlias(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("alias"); setNotice(null);
    try {
      const result = await updateAccountAlias(aliasName.trim(), aliasPassword);
      const next = await getAccountProfile();
      setAliasName(next.alias ?? result.alias);
      setAliasPassword("");
      onProfileUpdated?.(next);
      report("success", result.previousAlias && result.previousAlias !== result.alias ? "Wallet handle updated. Your previous handle remains reserved and continues resolving to this wallet." : result.previousAlias === result.alias ? "That wallet handle is already active." : "Wallet handle assigned.");
    } catch (cause) { report("error", cause instanceof Error ? cause.message : "Wallet handle could not be changed."); }
    finally { setBusy(""); }
  }

  async function enableDevicePasskey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isPasskeySupported()) { report("error", "Passkeys are unavailable in this browser or origin. Use a supported browser over HTTPS or localhost."); return; }
    if (!passkeyPassword) { report("error", "Confirm your current account password before enabling a passkey."); return; }
    setBusy("passkey"); setNotice(null);
    try {
      await registerPasskey(passkeyPassword, passkeyDeviceName.trim() || "This device");
      setPasskeys(await getPasskeys());
      setPasskeyPassword("");
      report("success", "Passkey registered and verified. Your private key remains with your device or passkey provider.");
    } catch (cause) {
      report("error", cause instanceof Error ? cause.message : "Passkey registration failed. Check the browser prompt and try again.");
    } finally { setBusy(""); }
  }

  async function confirmPasskeyRemoval(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!removingPasskeyId) return;
    setBusy("passkey-remove"); setNotice(null);
    try {
      await removePasskey(removingPasskeyId, removePasskeyPassword);
      setPasskeys(await getPasskeys());
      setRemovingPasskeyId("");
      setRemovePasskeyPassword("");
      report("success", "Passkey removed from this Subtle Pay account. Password sign-in remains available.");
    } catch (cause) {
      report("error", cause instanceof Error ? cause.message : "Passkey could not be removed.");
    } finally { setBusy(""); }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) { report("error", "New passwords do not match."); return; }
    setBusy("password"); setNotice(null);
    try {
      await changeAccountPassword(currentPassword, newPassword);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      report("success", "Password changed. Other active sessions were revoked; sign in again on other devices.");
      const fresh = await getAccountSessions().catch(() => []);
      setSessions(fresh);
    } catch (cause) { report("error", cause instanceof Error ? cause.message : "Password could not be changed."); }
    finally { setBusy(""); }
  }
  async function revokeSession(session: ActiveAccountSession) {
    setBusy("session:" + session.sessionId); setNotice(null);
    try {
      await revokeAccountSession(session.sessionId);
      setSessions((items) => items.filter((item) => item.sessionId !== session.sessionId));
      report("success", "Session revoked.");
    } catch (cause) { report("error", cause instanceof Error ? cause.message : "Session could not be revoked."); }
    finally { setBusy(""); }
  }
  async function enableMerchant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("merchant"); setNotice(null);
    try {
      const result = await enableMerchantProfile({ publicName: merchantName.trim() || undefined, category: merchantCategory });
      setMerchantEnabled(result.enabled); setMerchant(result.profile);
      report("success", "Merchant profile enabled. A verified badge appears only after review.");
    } catch (cause) { report("error", cause instanceof Error ? cause.message : "Merchant profile could not be enabled."); }
    finally { setBusy(""); }
  }
  async function submitAutopay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("autopay"); setNotice(null);
    try {
      const result = await applyForMerchantAutopay(autopayReason);
      setApplications((items) => [{ id: result.id, reason: autopayReason, status: result.status, createdAt: Date.now(), reviewedAt: null, reviewNote: null }, ...items]);
      setAutopayReason("");
      report("success", result.message);
    } catch (cause) { report("error", cause instanceof Error ? cause.message : "Autopay application could not be submitted."); }
    finally { setBusy(""); }
  }
  async function performDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (deleteConfirmation !== "DELETE") { report("error", "Type DELETE to confirm account deletion."); return; }
    setBusy("delete"); setNotice(null);
    try {
      await deleteAccount(deletePassword);
      report("success", "Account deleted and its signing key destroyed.");
      onLogout();
    } catch (cause) { report("error", cause instanceof Error ? cause.message : "Account deletion failed."); }
    finally { setBusy(""); }
  }

  const handle = profile?.alias ? `${profile.alias}@monad` : "Not assigned yet";
  return (
    <div className="page-stack inner-page more-page">
      <div className="page-intro"><div><div className="section-kicker">YOUR ACCOUNT</div><h1>Settings</h1><p>Profile, account access, security and preferences.</p></div><span className="page-icon-bubble"><Icon name="settings" size={20} /></span></div>

      <section className="profile-panel more-profile-summary">
        <span className="profile-avatar more-pixel-avatar"><img src={pixelAvatarUrl(profile?.displayName || handle, accountId || profile?.accountId || "wallet")} alt={`${(profile?.displayName || "Wallet").split(/\\s+/)[0]} pixel-art avatar`} /></span>
        <div className="profile-copy"><strong>{profile?.displayName || handle}{merchant?.status === "approved" && <span className="merchant-verified-badge more-profile-verified" title="Verified merchant" aria-label="Verified merchant">✓</span>}</strong><span>{profile?.accountId || accountId || "Signed-in account"}</span><small>{shortAddress(walletAddress)} · Monad Testnet</small></div>
        <span className="profile-status-dot" />
      </section>

      {notice && <div className={notice.kind === "success" ? "inline-notice success" : "inline-notice"} role="status"><Icon name={notice.kind === "success" ? "check-circle" : "info"} size={16} /><span>{notice.text}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><Icon name="close" size={14} /></button></div>}

      <nav className="settings-option-menu" aria-label="Settings sections">
        <div className="settings-menu-group">
          <button type="button" className={expandedSettingsCategory === "account" ? "settings-option-menu-parent active" : "settings-option-menu-parent"} onClick={() => toggleSettingsCategory("account")} aria-expanded={expandedSettingsCategory === "account"} aria-controls="settings-submenu-account"><Icon name="wallet" size={19} /><span><strong>Account Management</strong><small>Profile, wallet and saved accounts</small></span><span className="settings-menu-chevron" aria-hidden="true">{expandedSettingsCategory === "account" ? "−" : "+"}</span></button>
          {expandedSettingsCategory === "account" && <div className="settings-submenu" id="settings-submenu-account">
            <button type="button" className={activeSettingsSection === "profile" ? "settings-submenu-item active" : "settings-submenu-item"} onClick={() => toggleSettingsSection("profile", "account")} aria-pressed={activeSettingsSection === "profile"}><Icon name="user" size={16} />Profile & wallet</button>
            <button type="button" className={activeSettingsSection === "accounts" ? "settings-submenu-item active" : "settings-submenu-item"} onClick={() => toggleSettingsSection("accounts", "account")} aria-pressed={activeSettingsSection === "accounts"}><Icon name="users" size={16} />Saved accounts & switching</button>
          </div>}
        </div>
        <div className="settings-menu-group">
          <button type="button" className={expandedSettingsCategory === "security" ? "settings-option-menu-parent active" : "settings-option-menu-parent"} onClick={() => toggleSettingsCategory("security")} aria-expanded={expandedSettingsCategory === "security"} aria-controls="settings-submenu-security"><Icon name="shield" size={19} /><span><strong>Security & access</strong><small>Password, biometrics and devices</small></span><span className="settings-menu-chevron" aria-hidden="true">{expandedSettingsCategory === "security" ? "−" : "+"}</span></button>
          {expandedSettingsCategory === "security" && <div className="settings-submenu" id="settings-submenu-security">
            <button type="button" className={activeSettingsSection === "security" ? "settings-submenu-item active" : "settings-submenu-item"} onClick={() => toggleSettingsSection("security", "security")} aria-pressed={activeSettingsSection === "security"}><Icon name="key" size={16} />Password & MPIN</button>
            <button type="button" className={activeSettingsSection === "passkeys" ? "settings-submenu-item active" : "settings-submenu-item"} onClick={() => toggleSettingsSection("passkeys", "security")} aria-pressed={activeSettingsSection === "passkeys"}><Icon name="fingerprint" size={16} />Passkeys & biometrics</button>
            <button type="button" className={activeSettingsSection === "sessions" ? "settings-submenu-item active" : "settings-submenu-item"} onClick={() => toggleSettingsSection("sessions", "security")} aria-pressed={activeSettingsSection === "sessions"}><Icon name="smartphone" size={16} />Devices & sessions</button>
            <button type="button" className={activeSettingsSection === "history" ? "settings-submenu-item active" : "settings-submenu-item"} onClick={() => toggleSettingsSection("history", "security")} aria-pressed={activeSettingsSection === "history"}><Icon name="clock" size={16} />Login history</button>
          </div>}
        </div>
        <div className="settings-menu-group">
          <button type="button" className={expandedSettingsCategory === "preferences" ? "settings-option-menu-parent active" : "settings-option-menu-parent"} onClick={() => toggleSettingsCategory("preferences")} aria-expanded={expandedSettingsCategory === "preferences"} aria-controls="settings-submenu-preferences"><Icon name="sliders" size={19} /><span><strong>Preferences</strong><small>Personal display settings</small></span><span className="settings-menu-chevron" aria-hidden="true">{expandedSettingsCategory === "preferences" ? "−" : "+"}</span></button>
          {expandedSettingsCategory === "preferences" && <div className="settings-submenu" id="settings-submenu-preferences">
            <button type="button" className={activeSettingsSection === "currency" ? "settings-submenu-item active" : "settings-submenu-item"} onClick={() => toggleSettingsSection("currency", "preferences")} aria-pressed={activeSettingsSection === "currency"}><Icon name="globe" size={16} />Display currency</button>
          </div>}
        </div>
        <div className="settings-menu-group">
          <button type="button" className={expandedSettingsCategory === "merchant" ? "settings-option-menu-parent active" : "settings-option-menu-parent"} onClick={() => toggleSettingsCategory("merchant")} aria-expanded={expandedSettingsCategory === "merchant"} aria-controls="settings-submenu-merchant"><Icon name="merchant" size={19} /><span><strong>Merchant tools</strong><small>Merchant profile and Autopay</small></span><span className="settings-menu-chevron" aria-hidden="true">{expandedSettingsCategory === "merchant" ? "−" : "+"}</span></button>
          {expandedSettingsCategory === "merchant" && <div className="settings-submenu" id="settings-submenu-merchant">
            <button type="button" className={activeSettingsSection === "merchant" ? "settings-submenu-item active" : "settings-submenu-item"} onClick={() => toggleSettingsSection("merchant", "merchant")} aria-pressed={activeSettingsSection === "merchant"}><Icon name="merchant" size={16} />Merchant profile & Autopay</button>
          </div>}
        </div>
        <div className="settings-menu-group">
          <button type="button" className={expandedSettingsCategory === "actions" ? "settings-option-menu-parent active danger" : "settings-option-menu-parent danger"} onClick={() => toggleSettingsCategory("actions")} aria-expanded={expandedSettingsCategory === "actions"} aria-controls="settings-submenu-actions"><Icon name="alert" size={19} /><span><strong>Account actions</strong><small>Sign out or permanently delete account</small></span><span className="settings-menu-chevron" aria-hidden="true">{expandedSettingsCategory === "actions" ? "−" : "+"}</span></button>
          {expandedSettingsCategory === "actions" && <div className="settings-submenu" id="settings-submenu-actions">
            <button type="button" className={activeSettingsSection === "delete" ? "settings-submenu-item active danger" : "settings-submenu-item danger"} onClick={() => toggleSettingsSection("delete", "actions")} aria-pressed={activeSettingsSection === "delete"}><Icon name="alert" size={16} />Delete account</button>
            <button type="button" className="settings-submenu-item danger" onClick={() => setShowSignOutConfirm(true)}><Icon name="logout" size={16} />Sign out</button>
          </div>}
        </div>
      </nav>

      <section id="settings-profile" hidden={activeSettingsSection !== "profile"} className="panel more-settings-card">
        <div className="panel-heading compact"><div><div className="section-kicker">PERSONAL INFORMATION</div><h2>Profile & wallet handle</h2></div><Icon name="user" size={20} /></div>
        <form className="more-form" onSubmit={(event) => void saveProfile(event)}>
          <label className="field-label" htmlFor="more-display-name">Display name</label>
          <input id="more-display-name" className="form-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} placeholder="Your name" autoComplete="name" />
          <div className="more-handle-card"><span>Permanent wallet handle</span><strong>{handle}</strong><small>You can change this handle below after password confirmation. Older handles stay reserved and keep resolving to this wallet.</small></div>
          <label className="field-label" htmlFor="more-country">Country</label>
          <select id="more-country" className="form-select" value={country} onChange={(event) => setCountry(event.target.value)}>
            <option value="">Select your country</option>
            {countries.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
          </select>
          <p className="more-helper">Country is saved as a two-letter ISO country code. It is not published as a public location.</p>
          <button className="primary-button wide-button" type="submit" disabled={busy === "profile"}>{busy === "profile" ? "Saving…" : "Save profile"}</button>
        </form>
        <div className="more-divider" />
        <h3>Wallet alias</h3>
        <p className="more-helper">Your previous handle stays reserved and continues resolving to your wallet after a rename.</p>
        <form className="more-form" onSubmit={(event) => void saveAlias(event)}>
          <label className="field-label" htmlFor="more-alias">Alias (3–20 letters, numbers or underscores)</label>
          <div className="more-inline-control"><input id="more-alias" className="form-input" value={aliasName} onChange={(event) => setAliasName(event.target.value.toLowerCase().replace(/^@/, "").replace(/@monad$/, ""))} pattern="[a-zA-Z0-9_]{3,20}" minLength={3} maxLength={20} required autoComplete="off" /><span className="more-alias-suffix">@monad</span></div>
          <label className="field-label" htmlFor="more-alias-password">Confirm account password</label>
          <input id="more-alias-password" className="form-input" type="password" value={aliasPassword} onChange={(event) => setAliasPassword(event.target.value)} autoComplete="current-password" required />
          <button type="submit" className="secondary-button wide-button" disabled={Boolean(busy)}>{busy === "alias" ? "Updating…" : "Update wallet alias"}</button>
        </form>
      </section>

      <section id="settings-account-management" hidden={activeSettingsSection !== "accounts"} className="panel more-settings-card">
        <div className="panel-heading compact"><div><div className="section-kicker">ACCOUNT MANAGEMENT</div><h2>Accounts & switching</h2></div><Icon name="wallet" size={20} /></div>
        <p className="more-helper">Saved accounts on this device: <strong>{[...new Set([...savedIds, ...(accountId ? [accountId] : [])])].length}</strong>. Passwords are never stored on this device. Each switch reauthenticates to protect your wallet.</p>
        <form className="more-inline-form" onSubmit={addSavedAccount}>
          <label className="field-label" htmlFor="more-save-account">Add account ID</label>
          <div className="more-inline-control"><input id="more-save-account" className="form-input" value={newAccountId} onChange={(event) => setNewAccountId(event.target.value)} placeholder="Subtle Pay account ID" autoComplete="off" /><button type="submit" className="secondary-button">Save ID</button></div>
        </form>
        <div className="saved-account-list">
          {[...new Set([...savedIds, ...(accountId ? [accountId] : [])])].map((id) => (
            <div className="saved-account-row" key={id}>
              <span className="saved-account-icon"><Icon name={id === accountId ? "check-circle" : "wallet"} size={17} /></span>
              <span className="saved-account-copy"><strong>{id === accountId ? "Current account" : "Saved account"}</strong><small>{id}</small></span>
              {id !== accountId && <button type="button" className="secondary-button" onClick={() => { setSwitchingId(id); setSwitchPassword(""); void switchSavedAccountOnDevice(id); }} disabled={Boolean(busy)}>Switch</button>}
            </div>
          ))}
        </div>
        {switchingId && <form className="more-switch-form" onSubmit={(event) => void switchAccount(event)}>
          <p>Sign in to <strong>{switchingId}</strong></p>
          <label className="field-label" htmlFor="switch-account-password">Account password</label>
          <input id="switch-account-password" className="form-input" type="password" value={switchPassword} onChange={(event) => setSwitchPassword(event.target.value)} autoComplete="current-password" required />
          <div className="more-inline-actions"><button type="button" className="secondary-button" onClick={() => setSwitchingId("")} disabled={Boolean(busy)}>Cancel</button><button type="submit" className="primary-button" disabled={Boolean(busy)}>{busy === "switch:" + switchingId ? "Switching…" : "Sign in & switch"}</button></div>
        </form>}
      </section>

      <section id="settings-security" hidden={activeSettingsSection !== "security"} className="panel more-settings-card">
        <div className="panel-heading compact"><div><div className="section-kicker">SECURITY</div><h2>Password & payment MPIN</h2></div><Icon name="shield" size={20} /></div>
        <p className="more-helper">Payments can be authorized with your account password or a six-digit MPIN. You can also register a passkey in the Passkeys & biometric sign-in section; biometric verification depends on your device and passkey provider.</p>
        <form className="more-form" onSubmit={(event) => void changePassword(event)}>
          <h3>Change password</h3>
          <label className="field-label" htmlFor="more-current-password">Current password</label>
          <input id="more-current-password" className="form-input" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required />
          <label className="field-label" htmlFor="more-new-password">New password</label>
          <input id="more-new-password" className="form-input" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required />
          <label className="field-label" htmlFor="more-confirm-password">Confirm new password</label>
          <input id="more-confirm-password" className="form-input" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required />
          <button className="secondary-button wide-button" type="submit" disabled={Boolean(busy)}>Change password</button>
        </form>
        <div className="more-divider" />
        <div className="more-mpin-heading"><div><h3>Payment MPIN</h3><p>{mpinEnabled ? "Enabled for payment authorization." : "Not configured yet."}</p></div><span className={mpinEnabled ? "status-pill success" : "status-pill neutral"}>{mpinEnabled ? "Enabled" : "Not set"}</span></div>
        <form className="more-form" onSubmit={(event) => void saveMpin(event)}>
          <label className="field-label" htmlFor="more-mpin-password">Confirm account password</label>
          <input id="more-mpin-password" className="form-input" type="password" value={mpinPassword} onChange={(event) => setMpinPassword(event.target.value)} autoComplete="current-password" required />
          <label className="field-label" htmlFor="more-mpin">Six-digit MPIN</label>
          <input id="more-mpin" className="form-input" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} autoComplete="new-password" placeholder="••••••" required />
          <div className="more-inline-actions"><button type="submit" className="primary-button" disabled={Boolean(busy) || pin.length !== 6}>{mpinEnabled ? "Change MPIN" : "Set MPIN"}</button>{mpinEnabled && <button type="button" className="secondary-button" onClick={() => void disableMpin()} disabled={Boolean(busy)}>Disable MPIN</button>}</div>
        </form>
      </section>

      <section id="settings-passkeys" hidden={activeSettingsSection !== "passkeys"} className="panel more-settings-card more-passkey-card">
        <div className="panel-heading compact"><div><div className="section-kicker">DEVICE BIOMETRICS</div><h2>Passkeys & biometric sign-in</h2></div><Icon name="fingerprint" size={20} /></div>
        <p className="more-helper">Register a passkey with your device's native verification prompt. Depending on the device and passkey provider, it may use fingerprint, face recognition, or the device screen lock. Subtle Pay stores the public key and verification metadata—not your device's private key.</p>
        {!isPasskeySupported() && <p className="inline-notice">This browser or origin does not support WebAuthn passkeys. Use HTTPS on your real domain, or localhost for local development.</p>}
        <form className="more-form" onSubmit={(event) => void enableDevicePasskey(event)}>
          <label className="field-label" htmlFor="more-passkey-name">Device label</label>
          <input id="more-passkey-name" className="form-input" value={passkeyDeviceName} onChange={(event) => setPasskeyDeviceName(event.target.value.slice(0, 60))} maxLength={60} required placeholder="This device" />
          <label className="field-label" htmlFor="more-passkey-password">Confirm account password</label>
          <input id="more-passkey-password" className="form-input" type="password" value={passkeyPassword} onChange={(event) => setPasskeyPassword(event.target.value)} autoComplete="current-password" required />
          <button className="primary-button wide-button" type="submit" disabled={Boolean(busy) || !isPasskeySupported()}>{busy === "passkey" ? "Waiting for device verification…" : "Enable passkey"}</button>
        </form>
        <div className="more-divider" />
        <div className="more-passkey-list-heading"><h3>Registered passkeys</h3><span className="status-pill neutral">{passkeys.length} registered</span></div>
        {passkeys.length === 0 ? <p className="more-empty-copy">No passkeys registered. Password and MPIN authorization remain available.</p> : <div className="more-passkey-list">
          {passkeys.map((passkey) => <article className="more-passkey-row" key={passkey.credentialId}>
            <span className="saved-account-icon"><Icon name="fingerprint" size={18} /></span>
            <div className="more-passkey-copy"><strong>{passkey.deviceName}</strong><small>{passkey.deviceType === "multiDevice" ? "Synced passkey" : "Device-bound passkey"}{passkey.backedUp ? " · Backup available" : ""}</small><small>Added {time(passkey.createdAt)} · Last used {time(passkey.lastUsedAt)}</small></div>
            <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => { setRemovingPasskeyId(passkey.credentialId); setRemovePasskeyPassword(""); }}>Remove</button>
          </article>)}
        </div>}
        {removingPasskeyId && <form className="more-form more-passkey-remove-form" onSubmit={(event) => void confirmPasskeyRemoval(event)}>
          <p className="more-helper">Confirm your account password to remove this passkey from Subtle Pay. This does not erase copies synced by your device/passkey provider.</p>
          <label className="field-label" htmlFor="more-remove-passkey-password">Account password</label>
          <input id="more-remove-passkey-password" className="form-input" type="password" value={removePasskeyPassword} onChange={(event) => setRemovePasskeyPassword(event.target.value)} autoComplete="current-password" required />
          <div className="more-inline-actions"><button type="button" className="secondary-button" onClick={() => { setRemovingPasskeyId(""); setRemovePasskeyPassword(""); }} disabled={Boolean(busy)}>Cancel</button><button type="submit" className="primary-button" disabled={Boolean(busy)}>{busy === "passkey-remove" ? "Removing…" : "Confirm removal"}</button></div>
        </form>}
      </section>

      <section id="settings-sessions" hidden={activeSettingsSection !== "sessions"} className="panel more-settings-card">
        <div className="panel-heading compact"><div><div className="section-kicker">ACTIVE SESSIONS</div><h2>Devices & login access</h2></div><Icon name="smartphone" size={20} /></div>
        <p className="more-helper">Revoke other sessions you no longer recognize. Session records are logged by the backend.</p>
        {sessions.length === 0 ? <p className="more-empty-copy">No other active sessions are listed.</p> : <div className="more-session-list">{sessions.map((session) => <article className="more-session-row" key={session.sessionId}>
          <span className="saved-account-icon"><Icon name="smartphone" size={18} /></span>
          <div className="more-session-copy"><strong>{session.current ? "This session" : "Signed-in session"}</strong><small>{session.userAgent || "Browser/device not reported"}</small><small>{session.ip || "IP not reported"} · Last activity {time(session.lastSeenAt)}</small><small>Expires {time(session.expiresAt)}</small></div>
          {session.current ? <span className="status-pill neutral">Current</span> : <button type="button" className="secondary-button" onClick={() => void revokeSession(session)} disabled={Boolean(busy)}>Revoke</button>}
        </article>)}</div>}
      </section>

      <section id="settings-login-history" hidden={activeSettingsSection !== "history"} className="panel more-settings-card">
        <div className="panel-heading compact"><div><div className="section-kicker">RECENT ACCESS</div><h2>Login history</h2></div><Icon name="clock" size={20} /></div>
        <p className="more-helper">Recent login events for this account. Failed attempts before the account is identified may not be linked to this history.</p>
        {loginHistory.length === 0 ? <p className="more-empty-copy">No login events are available yet.</p> : <div className="more-login-list">
          {loginHistory.map((event) => <article key={event.id}>
            <span className={event.success ? "more-login-icon success" : "more-login-icon failed"}><Icon name={event.success ? "check-circle" : "alert"} size={17} /></span>
            <div><strong>{event.success ? "Successful login" : "Failed login"}</strong><small>{time(event.eventAt)} · {event.reason.replaceAll("_", " ")}</small><small>{event.ip || "IP not recorded"}</small><small>{event.userAgent || "Browser not recorded"}</small></div>
          </article>)}
        </div>}
      </section>

      <section id="settings-currency" hidden={activeSettingsSection !== "currency"} className="panel more-settings-card">
        <div className="panel-heading compact"><div><div className="section-kicker">PREFERENCES</div><h2>Display currency</h2></div><Icon name="globe" size={20} /></div>
        <form className="more-form" onSubmit={(event) => void saveCurrency(event)}>
          <label className="field-label" htmlFor="more-currency">Default display / quote currency</label>
          <select id="more-currency" className="form-select" value={currency} disabled={busy === "currency"} onChange={(event) => setCurrency(event.target.value)} required>
            {currency && !currencies.includes(currency) && <option value={currency}>Current saved preference — {currency}</option>}
            {currencies.map((code) => { const option = CURRENCIES.find((item) => item.code.toUpperCase() === code); return <option value={code} key={code}>{option ? `${option.symbol} ${option.name} (${code})` : code}</option>; })}
          </select>
          <label className="field-label" htmlFor="more-currency-password">Confirm account password to save</label>
          <input id="more-currency-password" className="form-input" type="password" value={currencyPassword} onChange={(event) => setCurrencyPassword(event.target.value)} autoComplete="current-password" required />
          <button className="primary-button wide-button" type="submit" disabled={busy === "currency"}>{busy === "currency" ? "Saving…" : "Save currency"}</button>
        </form>
        <p className="more-helper">This controls displayed values and quotes. Monad Testnet transfers still settle in MON; this preference does not by itself change the settlement asset.</p>
      </section>

            <section id="settings-merchant" hidden={activeSettingsSection !== "merchant"} className="panel more-settings-card">
        <div className="panel-heading compact"><div><div className="section-kicker">MERCHANT TOOLS</div><h2>Merchant profile & Autopay</h2></div><Icon name="merchant" size={20} /></div>
        {merchantEnabled && merchant ? <div className="merchant-profile-summary"><div><strong>{merchant.publicName}</strong><small>{merchant.category} · {merchant.status}</small></div><span className={merchant.status === "approved" ? "merchant-verified-badge" : "status-pill neutral"}>{merchant.status === "approved" ? "✓ Verified" : "Not verified"}</span></div>
          : <form className="more-form" onSubmit={(event) => void enableMerchant(event)}>
            <p className="more-helper">Anyone can enable a public merchant profile. The yellow verified badge is reserved for profiles approved by Subtle Pay staff.</p>
            <label className="field-label" htmlFor="more-merchant-name">Public merchant name</label><input id="more-merchant-name" className="form-input" value={merchantName} onChange={(event) => setMerchantName(event.target.value)} maxLength={80} placeholder="Display name or shop name" />
            <label className="field-label" htmlFor="more-merchant-category">Category</label><select id="more-merchant-category" className="form-select" value={merchantCategory} onChange={(event) => setMerchantCategory(event.target.value)}><option value="individual">Individual / creator</option><option value="retail">Retail</option><option value="services">Services</option><option value="online">Online business</option><option value="other">Other</option></select>
            <button type="submit" className="primary-button wide-button" disabled={Boolean(busy)}>{busy === "merchant" ? "Enabling…" : "Enable merchant profile"}</button>
          </form>}
        {merchantEnabled && merchant && <button type="button" className="primary-button wide-button more-merchant-centre-button" onClick={() => onOpenMerchantCentre?.()}>Open Merchant Centre <Icon name="arrow-up-right" size={16} /></button>}
        <div className="more-divider" />
        <h3>Apply for Autopay</h3><p className="more-helper">Autopay stays unavailable until a team member approves the application. Submitting an application does not activate recurring payments.</p>
        <form className="more-form" onSubmit={(event) => void submitAutopay(event)}>
          <label className="field-label" htmlFor="more-autopay-reason">Why do you need Autopay?</label><textarea id="more-autopay-reason" className="form-input more-textarea" value={autopayReason} onChange={(event) => setAutopayReason(event.target.value)} minLength={10} maxLength={1000} rows={3} placeholder="Describe the intended recurring-payment use case" required />
          <button className="secondary-button wide-button" type="submit" disabled={Boolean(busy) || !merchantEnabled}>{busy === "autopay" ? "Submitting…" : "Submit Autopay application"}</button>
        </form>
        {applications.length > 0 && <div className="more-application-list"><h3>Your applications</h3>{applications.map((application) => <article key={application.id}><div><strong>{application.status === "pending" ? "Pending review" : application.status === "approved" ? "Approved" : "Not approved"}</strong><small>{time(application.createdAt)}</small>{application.reviewNote && <small>{application.reviewNote}</small>}</div><span className={application.status === "approved" ? "status-pill success" : application.status === "rejected" ? "status-pill warning" : "status-pill neutral"}>{application.status}</span></article>)}</div>}
      </section>

      <section id="settings-delete" hidden={activeSettingsSection !== "delete"} className="panel more-danger-zone">
        <div className="panel-heading compact"><div><div className="section-kicker">IRREVERSIBLE ACTION</div><h2>Delete account</h2></div><Icon name="alert" size={20} /></div>
        <p>Deletion revokes sessions, releases your handle, removes the permanent QR record, and destroys the encrypted wallet signing key. Existing transaction records remain for audit history. This cannot be undone.</p>
        <form className="more-form" onSubmit={(event) => void performDelete(event)}>
          <label className="field-label" htmlFor="more-delete-password">Account password</label><input id="more-delete-password" className="form-input" type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} autoComplete="current-password" required />
          <label className="field-label" htmlFor="more-delete-confirm">Type DELETE to confirm</label><input id="more-delete-confirm" className="form-input" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" required />
          <button type="submit" className="danger-button wide-button" disabled={Boolean(busy) || deleteConfirmation !== "DELETE"}>{busy === "delete" ? "Deleting…" : "Delete account & destroy key"}</button>
        </form>
      </section>

      <button type="button" className="secondary-button more-signout-button" onClick={() => setShowSignOutConfirm(true)} disabled={Boolean(busy)}><Icon name="logout" size={16} /> Sign out</button>

      {showSignOutConfirm && <div className="signout-confirm-backdrop">
        <section className="signout-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="signout-confirm-title" aria-describedby="signout-confirm-description">
          <span className="signout-confirm-icon"><Icon name="shield" size={24} /></span>
          <div className="section-kicker">SECURITY REMINDER</div>
          <h2 id="signout-confirm-title">Before you sign out</h2>
          <div id="signout-confirm-description" className="signout-confirm-copy">
            <p>Make sure you know your Subtle Pay account ID and can access your password or a registered passkey before continuing. You may need them to sign in again.</p>
            <p>Signing out ends this session only. It does not delete your account or initiate a payment or transfer.</p>
          </div>
          <div className="signout-confirm-actions">
            <button type="button" className="secondary-button" onClick={() => setShowSignOutConfirm(false)}>Stay signed in</button>
            <button type="button" className="danger-button" onClick={() => { setShowSignOutConfirm(false); onLogout(); }}>Sign out</button>
          </div>
        </section>
      </div>}
    </div>
  );
}
