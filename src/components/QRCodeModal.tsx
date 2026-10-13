import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { copyText } from "../services/walletService";

type Props = { handle?: string | null; address: string; chainId?: number | null; onClose: () => void };

export default function QRCodeModal({ handle, address, chainId, onClose }: Props) {
  const [copied, setCopied] = useState(false);

 async function copy() {
  await copyText(address);
  setCopied(true);
  setTimeout(() => setCopied(false), 1500);
 }

  async function share() {
    const text = `${handle ? handle + "\n" : ""}${address}`;
    if (navigator.share) {
      try { await navigator.share({ title: "Subtle Pay", text }); } catch { /* closed */ }
    } else {
      copy();
    }
  }

  return (
    <div className="contacts-modal-backdrop" onClick={onClose}>
      <section className="panel contacts-modal qr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="contacts-header">
          <div>
            <span className="section-kicker">QR MODE</span>
            <h2>Scan to pay me</h2>
            <p>{handle || "Your receiving address"}</p>
          </div>
          <button type="button" className="contacts-close-button" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="qr-sheet">
         <QRCodeSVG value={buildPayQR(handle, address, chainId)} size={220} fgColor="#101a33" level="M" />
        </div>
        <p className="receive-full-address">{address}</p>

        <div className="button-row">
          <button type="button" className="secondary-button" onClick={copy}>
            {copied ? "Copied" : "Copy address"}
          </button>
          <button type="button" className="primary-button" onClick={share}>Share</button>
        </div>
      </section>
    </div>
  );
}