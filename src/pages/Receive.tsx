import { useState } from "react";
import Icon from "../components/Icon";
import { copyText } from "../services/walletService";
import { getPersonalPaymentQr } from "../services/accountService";
import QRCodeModal from "../components/QRCodeModal";

export default function Receive({
  walletAddress = null,
  displayName = "",
  handle = null,
  chainId = 10143,
}: {
  walletAddress?: string | null;
  walletChainId?: string | null;
  displayName?: string;
  handle?: string | null;
  chainId?: number;
  onConnectWallet?: () => void;
}) {
  const [notice, setNotice] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  async function openQr() {
    setShowQr(true);
    setQrPayload(null);
    setQrLoading(true);
    setNotice("");
    try {
      const result = await getPersonalPaymentQr();
      setQrPayload(result.payload);
    } catch (cause) {
      setShowQr(false);
      setNotice(cause instanceof Error ? cause.message : "Could not generate a verified payment QR.");
    } finally {
      setQrLoading(false);
    }
  }

  async function copyAddress() {
    if (!walletAddress) { setNotice("Account wallet address is not available. Sign in again."); return; }
    try { await copyText(walletAddress); setNotice("Monad Testnet receiving address copied."); }
    catch { setNotice("Clipboard access is unavailable. Select and copy the address manually."); }
  }

  async function shareAddress() {
    if (!walletAddress) { setNotice("Account wallet address is not available. Sign in again."); return; }
    const text = `Subtle Pay · Monad Testnet\nAccount: ${displayName || "Subtle Pay"}\nAddress: ${walletAddress}\nOnly send testnet MON for this hackathon demo.`;
    try {
      if (navigator.share) await navigator.share({ title: "Subtle Pay testnet receiving address", text });
      else { await copyText(text); setNotice("Sharing is unavailable; receiving details copied instead."); }
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setNotice("Sharing couldn't open. Copy the address and network instead.");
    }
  }

  return (
    <div className="page-stack inner-page receive-page">
      <div className="page-intro"><div><div className="section-kicker">INCOMING TESTNET PAYMENTS</div><h1>Receive money</h1><p>Your Subtle Pay account has a backend-managed Monad Testnet wallet.</p></div><span className="page-icon-bubble"><Icon name="receive" size={20} /></span></div>
      {!walletAddress ? <section className="panel"><h2>Account wallet unavailable</h2><p>Sign in again to load your account wallet address.</p></section> : <>
        <section className="receive-hero-panel"><div className="receive-hero-copy"><span className="section-kicker light">YOUR SUBTLE PAY WALLET</span><h2>Ready to <span>receive</span></h2><p>Share this address and tell the sender to use Monad Testnet (chain ID 10143).</p></div><button type="button" className="receive-qr-box receive-network-icon" onClick={() => void openQr()} aria-label="Show personal payment QR"><Icon name="qr" size={42} /><span>SHOW PAYMENT QR</span></button></section>
        <section className="panel address-panel">
          <div className="panel-heading compact"><div><div className="section-kicker">RECEIVING NETWORK</div><h2>Monad Testnet</h2></div><span className="status-pill neutral">Chain 10143</span></div>
          <div className="receive-address-label"><span>ACCOUNT WALLET ADDRESS</span><button type="button" onClick={() => void copyAddress()}><Icon name="copy" size={14} /> Copy</button></div>
          <div className="receive-full-address" title={walletAddress}>{walletAddress}</div>
          <div className="receive-address-meta"><Icon name="shield" size={15} /><span>Backend-managed account wallet · Testnet only</span></div>
          <div className="button-row receive-action-row"><button type="button" className="primary-button" onClick={() => void openQr()}><Icon name="qr" size={16} /> Show payment QR</button><button type="button" className="secondary-button" onClick={() => void copyAddress()}><Icon name="copy" size={16} /> Copy address</button><button type="button" className="secondary-button" onClick={() => void shareAddress()}><Icon name="arrow-up-right" size={16} /> Share details</button></div>
          <div className="account-testnet-note">Only send native testnet MON in the hackathon build. Do not send real funds, mainnet tokens, or tokens from a different network to this testnet address.</div>
          {notice && <div className="inline-notice" role="status"><Icon name="info" size={16} /><span>{notice}</span></div>}
        </section>
      </>}
      {showQr && qrPayload && walletAddress && <QRCodeModal handle={handle} address={walletAddress} chainId={chainId} payload={qrPayload} onClose={() => setShowQr(false)} />}
      {showQr && qrLoading && <div className="inline-notice" role="status">Generating a verified Monad Testnet payment QR…</div>}
      <section className="panel"><div className="panel-heading compact"><div><div className="section-kicker">INBOUND ACTIVITY</div><h2>Incoming payments</h2></div></div><p>Incoming payments from Subtle Pay accounts are listed in Activity after the backend records the transaction. Direct transfers from external wallets may change the on-chain balance without creating a Subtle Pay payment-history record.</p></section>
    </div>
  );
}
