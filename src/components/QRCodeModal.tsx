import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { copyText } from "../services/walletService";
import { getSignedPayQr } from "../services/accountService";

type Props = { handle?: string | null; address: string; chainId?: number | null; onClose: () => void };

export default function QRCodeModal({ handle, address, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [payload, setPayload] = useState("");
  useEffect(() => {
    let alive = true;
    void getSignedPayQr()
      .then((value) => { if (alive && value.address.toLowerCase() === address.toLowerCase()) setPayload(value.payload); })
      .catch(() => setPayload(""));
    return () => { alive = false; };
  }, [address]);

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
      await copy();
    }
  }

  return (
    <div className="contacts-modal-backdrop" onClick={onClose}>
      <section className="panel contacts-modal qr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="contacts-header">
          <div><span className="section-kicker">QR MODE</span><h2>Scan to pay me</h2><p>{handle || "Your receiving address"}</p></div>
          <button type="button" className="contacts-close-button" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="qr-sheet">{payload ? <QRCodeSVG value={payload} size={220} fgColor="#101a33" level="H" imageSettings={{ src: "/subtle-pay-mark.svg", width: 38, height: 38, excavate: true }} /> : <p role="status">Loading secure QR…</p>}</div>
        <p className="receive-full-address">{address}</p>
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={() => void copy()}>{copied ? "Copied" : "Copy address"}</button>
          <button type="button" className="primary-button" onClick={() => void share()}>Share</button>
        </div>
      </section>
    </div>
  );
}
