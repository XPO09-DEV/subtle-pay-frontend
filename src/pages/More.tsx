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
  loginAccount,
  removeAccountMpin,
  revokeAccountSession,
  setAccountMpin,
  updateAccountCurrency,
  updateAccountProfile,
  type ActiveAccountSession,
  type LoginHistoryEvent,
  type MerchantAutopayApplication,
  type MerchantProfile,
} from "../services/accountService";
import { getSupportedCurrencies } from "../services/accountService";

type MoreProps = {
  accountId?: string;
  walletAddress?: string | null;
  profile?: AccountProfile | null;
  onLogout: () => void;
  onAccountSwitched?: (profile: AccountProfile) => void;
  onProfileUpdated?: (profile: AccountProfile) => void;
};
type Notice = { kind: "success" | "error"; text: string };
const SAVED_ACCOUNTS_KEY = "subtlepay.saved.account-ids.v1";

function readSavedAccounts(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SAVED_ACCOUNTS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string").slice(0, 10) : [];
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

export default function More({
  accountId = "", walletAddress = null, profile = null, onLogout, onAccountSwitched, onProfileUpdated,
}: MoreProps) {
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [region, setRegion] = useState(profile?.region ?? "");
  const [shareRegion, setShareRegion] = useState(Boolean(profile?.regionConsentAt));
  const [currency, setCurrency] = useState(profile?.currency ?? "USD");
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
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => { setDisplayName(profile?.displayName ?? ""); setRegion(profile?.region ?? ""); setShareRegion(Boolean(profile?.regionConsentAt)); setCurrency(profile?.currency ?? "USD"); setMerchantName(profile?.displayName ?? ""); }, [profile?.displayName, profile?.region, profile?.regionConsentAt, profile?.currency]);
  useEffect(() => {
    const ids = [...new Set([...savedIds, ...(accountId ? [accountId] : [])])].slice(0, 10);
    setSavedIds(ids);
    saveIds(ids);
  // The active id is a device preference; no passwords are stored here.
  }, [accountId]);
  useEffect(() => {
    let alive = true;
    void getSupportedCurrencies().then((items) => { if (alive && items.length) setCurrencies(items); }).catch(() => undefined);
    void getMpinStatus().then((value) => { if (alive) setMpinEnabled(value.enabled); }).catch(() => undefined);
    void getAccountSessions().then((items) => { if (alive) setSessions(items); }).catch(() => undefined);
    void getAccountLoginHistory(20).then((items) => { if (alive) setLoginHistory(items); }).catch(() => undefined);
    void getMerchantProfile().then((value) => { if (alive) { setMerchantEnabled(value.enabled); setMerchant(value.profile); } }).catch(() => undefined);
    void getMerchantAutopayApplications().then((items) => { if (alive) setApplications(items); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  function report(kind: Notice["kind"], text: string) { setNotice({ kind, text }); }
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("profile"); setNotice(null);
    try {
      await updateAccountProfile({ displayName: displayName.trim() || null, region: shareRegion ? region.trim() || undefined : null, shareRegion });
      const next = await getAccountProfile();
      setDisplayName(next.displayName ?? ""); setRegion(next.region ?? ""); setShareRegion(Boolean(next.regionConsentAt));
      onProfileUpdated?.(next);
      report("success", next.alias ? `Profile saved. Your permanent handle is ${next.alias}@monad.` : "Profile saved.");
    } catch (cause) { report("error", cause instanceof Error ? cause.message : "Profile could not be saved."); }
    finally { setBusy(""); }
  }
  async function saveCurrency(value: string) {
    setBusy("currency"); setNotice(null);
    try {
      await updateAccountCurrency(value);
      setCurrency(value);
      const next = await getAccountProfile();
      onProfileUpdated?.(next);
      report("success", "Display currency updated.");
    } catch (cause) { report("error", cause instanceof Error ? cause.message : "Currency could not be updated."); }
    finally { setBusy(""); }
  }
  function addSavedAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = newAccountId.trim().toUpperCase();
    if (!id || id.length < 10 || id.length > 40) { report("error", "Enter a valid Subtle Pay account ID."); return; }
    if (savedIds.includes(id)) { report("error", "That account is already saved on this device."); return; }
    const next = [...savedIds, id].slice(-10);
    setSavedIds(next); saveIds(next); setNewAccountId("");
    report("success", "Account ID saved on this device. Its password is not stored.");
  }
  async function switchAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = switchingId.trim().toUpperCase();
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
      <div className="page-intro"><div><div className="section-kicker">YOUR ACCOUNT</div><h1>More</h1><p>Profile, account access, security and preferences.</p></div><span className="page-icon-bubble"><Icon name="settings" size={20} /></span></div>

      <section className="profile-panel more-profile-summary">
        <span className="profile-avatar"><Icon name="user" size={22} /></span>
        <div className="profile-copy"><strong>{profile?.displayName || handle}</strong><span>{profile?.accountId || accountId || "Signed-in account"}</span><small>{shortAddress(walletAddress)} · Monad Testnet</small></div>
        <span className="profile-status-dot" />
      </section>

      {notice && <div className={notice.kind === "success" ? "inline-notice success" : "inline-notice"} role="status"><Icon name={notice.kind === "success" ? "check-circle" : "info"} size={16} /><span>{notice.text}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><Icon name="close" size={14} /></button></div>}

      <section className="panel more-settings-card">
        <div className="panel-heading compact"><div><div className="section-kicker">PERSONAL INFORMATION</div><h2>Profile & wallet handle</h2></div><Icon name="user" size={20} /></div>
        <form className="more-form" onSubmit={(event) => void saveProfile(event)}>
          <label className="field-label" htmlFor="more-display-name">Display name</label>
          <input id="more-display-name" className="form-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} placeholder="Your name" autoComplete="name" />
          <div className="more-handle-card"><span>Permanent wallet handle</span><strong>{handle}</strong><small>Assigned on first profile save and stays with this account until you delete it.</small></div>
          <label className="field-label" htmlFor="more-region">Optional region</label>
          <input id="more-region" className="form-input" value={region} onChange={(event) => setRegion(event.target.value)} maxLength={80} placeholder="City or region (optional)" />
          <label className="more-consent-row"><input type="checkbox" checked={shareRegion} onChange={(event) => setShareRegion(event.target.checked)} /><span><strong>Share my region</strong><small>Only shared when you explicitly opt in.</small></span></label>
          <button className="primary-button wide-button" type="submit" disabled={busy === "profile"}>{busy === "profile" ? "Saving…" : "Save profile"}</button>
        </form>
      </section>

      <section className="panel more-settings-card">
        <div className="panel-heading compact"><div><div className="section-kicker">ACCOUNT MANAGEMENT</div><h2>Accounts & switching</h2></div><Icon name="wallet" size={20} /></div>
        <p className="more-helper">Save account IDs on this device and switch by authenticating again. Passwords are never stored here.</p>
        <form className="more-inline-form" onSubmit={addSavedAccount}>
          <label className="field-label" htmlFor="more-save-account">Add account ID</label>
          <div className="more-inline-control"><input id="more-save-account" className="form-input" value={newAccountId} onChange={(event) => setNewAccountId(event.target.value)} placeholder="Subtle Pay account ID" autoComplete="off" /><button type="submit" className="secondary-button">Save ID</button></div>
        </form>
        <div className="saved-account-list">
          {[...new Set([...savedIds, ...(accountId ? [accountId] : [])])].map((id) => (
            <div className="saved-account-row" key={id}>
              <span className="saved-account-icon"><Icon name={id === accountId ? "check-circle" : "wallet"} size={17} /></span>
              <span className="saved-account-copy"><strong>{id === accountId ? "Current account" : "Saved account"}</strong><small>{id}</small></span>
              {id !== accountId && <button type="button" className="secondary-button" onClick={() => { setSwitchingId(id); setSwitchPassword(""); }} disabled={Boolean(busy)}>Switch</button>}
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

      <section className="panel more-settings-card">
        <div className="panel-heading compact"><div><div className="section-kicker">SECURITY</div><h2>Password & payment MPIN</h2></div><Icon name="shield" size={20} /></div>
        <p className="more-helper">Every payment must be authorized with your account password or a six-digit MPIN. Device biometrics/passkeys are not enabled yet.</p>
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

      <section className="panel more-settings-card">
        <div className="panel-heading compact"><div><div className="section-kicker">ACTIVE SESSIONS</div><h2>Devices & login access</h2></div><Icon name="smartphone" size={20} /></div>
        <p className="more-helper">Revoke other sessions you no longer recognize. Session records are logged by the backend.</p>
        {sessions.length === 0 ? <p className="more-empty-copy">No other active sessions are listed.</p> : <div className="more-session-list">{sessions.map((session) => <article className="more-session-row" key={session.sessionId}>
          <span className="saved-account-icon"><Icon name="smartphone" size={18} /></span>
          <div className="more-session-copy"><strong>{session.current ? "This session" : "Signed-in session"}</strong><small>{session.userAgent || "Browser/device not reported"}</small><small>{session.ip || "IP not reported"} · Last activity {time(session.lastSeenAt)}</small><small>Expires {time(session.expiresAt)}</small></div>
          {session.current ? <span className="status-pill neutral">Current</span> : <button type="button" className="secondary-button" onClick={() => void revokeSession(session)} disabled={Boolean(busy)}>Revoke</button>}
        </article>)}</div>}
      </section>

      <section className="panel more-settings-card">
        <div className="panel-heading compact"><div><div className="section-kicker">RECENT ACCESS</div><h2>Login history</h2></div><Icon name="clock" size={20} /></div>
        <p className="more-helper">Recent login events for this account. Failed attempts before the account is identified may not be linked to this history.</p>
        {loginHistory.length === 0 ? <p className="more-empty-copy">No login events are available yet.</p> : <div className="more-login-list">
          {loginHistory.map((event) => <article key={event.id}>
            <span className={event.success ? "more-login-icon success" : "more-login-icon failed"}><Icon name={event.success ? "check-circle" : "alert"} size={17} /></span>
            <div><strong>{event.success ? "Successful login" : "Failed login"}</strong><small>{time(event.eventAt)} · {event.reason.replaceAll("_", " ")}</small><small>{event.ip || "IP not recorded"}</small><small>{event.userAgent || "Browser not recorded"}</small></div>
          </article>)}
        </div>}
      </section>

      <section className="panel more-settings-card">
        <div className="panel-heading compact"><div><div className="section-kicker">PREFERENCES</div><h2>Display currency</h2></div><Icon name="globe" size={20} /></div>
        <label className="field-label" htmlFor="more-currency">Default currency for estimates</label>
        <select id="more-currency" className="form-select" value={currency} disabled={busy === "currency"} onChange={(event) => void saveCurrency(event.target.value)}>
          {currencies.map((code) => <option value={code} key={code}>{code}</option>)}
        </select>
        <p className="more-helper">Currency changes affect display and estimates, not the Monad Testnet settlement asset.</p>
      </section>

      <section className="panel more-settings-card">
        <div className="panel-heading compact"><div><div className="section-kicker">MERCHANT TOOLS</div><h2>Merchant profile & Autopay</h2></div><Icon name="merchant" size={20} /></div>
        {merchantEnabled && merchant ? <div className="merchant-profile-summary"><div><strong>{merchant.publicName}</strong><small>{merchant.category} · {merchant.status}</small></div><span className={merchant.status === "approved" ? "merchant-verified-badge" : "status-pill neutral"}>{merchant.status === "approved" ? "✓ Verified" : "Not verified"}</span></div>
          : <form className="more-form" onSubmit={(event) => void enableMerchant(event)}>
            <p className="more-helper">Anyone can enable a public merchant profile. The yellow verified badge is reserved for profiles approved by Subtle Pay staff.</p>
            <label className="field-label" htmlFor="more-merchant-name">Public merchant name</label><input id="more-merchant-name" className="form-input" value={merchantName} onChange={(event) => setMerchantName(event.target.value)} maxLength={80} placeholder="Display name or shop name" />
            <label className="field-label" htmlFor="more-merchant-category">Category</label><select id="more-merchant-category" className="form-select" value={merchantCategory} onChange={(event) => setMerchantCategory(event.target.value)}><option value="individual">Individual / creator</option><option value="retail">Retail</option><option value="services">Services</option><option value="online">Online business</option><option value="other">Other</option></select>
            <button type="submit" className="primary-button wide-button" disabled={Boolean(busy)}>{busy === "merchant" ? "Enabling…" : "Enable merchant profile"}</button>
          </form>}
        <div className="more-divider" />
        <h3>Apply for Autopay</h3><p className="more-helper">Autopay stays unavailable until a team member approves the application. Submitting an application does not activate recurring payments.</p>
        <form className="more-form" onSubmit={(event) => void submitAutopay(event)}>
          <label className="field-label" htmlFor="more-autopay-reason">Why do you need Autopay?</label><textarea id="more-autopay-reason" className="form-input more-textarea" value={autopayReason} onChange={(event) => setAutopayReason(event.target.value)} minLength={10} maxLength={1000} rows={3} placeholder="Describe the intended recurring-payment use case" required />
          <button className="secondary-button wide-button" type="submit" disabled={Boolean(busy) || !merchantEnabled}>{busy === "autopay" ? "Submitting…" : "Submit Autopay application"}</button>
        </form>
        {applications.length > 0 && <div className="more-application-list"><h3>Your applications</h3>{applications.map((application) => <article key={application.id}><div><strong>{application.status === "pending" ? "Pending review" : application.status === "approved" ? "Approved" : "Not approved"}</strong><small>{time(application.createdAt)}</small>{application.reviewNote && <small>{application.reviewNote}</small>}</div><span className={application.status === "approved" ? "status-pill success" : application.status === "rejected" ? "status-pill warning" : "status-pill neutral"}>{application.status}</span></article>)}</div>}
      </section>

      <section className="panel more-danger-zone">
        <div className="panel-heading compact"><div><div className="section-kicker">IRREVERSIBLE ACTION</div><h2>Delete account</h2></div><Icon name="alert" size={20} /></div>
        <p>Deletion revokes sessions, releases your handle, removes the permanent QR record, and destroys the encrypted wallet signing key. Existing transaction records remain for audit history. This cannot be undone.</p>
        <form className="more-form" onSubmit={(event) => void performDelete(event)}>
          <label className="field-label" htmlFor="more-delete-password">Account password</label><input id="more-delete-password" className="form-input" type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} autoComplete="current-password" required />
          <label className="field-label" htmlFor="more-delete-confirm">Type DELETE to confirm</label><input id="more-delete-confirm" className="form-input" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" required />
          <button type="submit" className="danger-button wide-button" disabled={Boolean(busy) || deleteConfirmation !== "DELETE"}>{busy === "delete" ? "Deleting…" : "Delete account & destroy key"}</button>
        </form>
      </section>

      <button type="button" className="secondary-button more-signout-button" onClick={onLogout} disabled={Boolean(busy)}><Icon name="logout" size={16} /> Sign out</button>
    </div>
  );
}
