import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getSignedPayQr } from "../services/accountService";
import Icon from "../components/Icon";
import { copyText } from "../services/walletService";

type ReceiveProps = {
  walletAddress?: string | null;
  walletChainId?: string | null;
  displayName?: string;
  accountAlias?: string | null;
  onConnectWallet?: () => void;
};

function displayAlias(alias: string | null | undefined) {
  if (!alias) return "";
  return alias.replace(/^@/, "").replace(/@monad$/i, "") + "@monad";
}

export default function Receive({ walletAddress = null, displayName = "", accountAlias = null }: ReceiveProps) {
  const [notice, setNotice] = useState("");
  const [payQr, setPayQr] = useState("");
  const [payQrAlias, setPayQrAlias] = useState<string | null>(null);
  const [qrError, setQrError] = useState("");
  const [shareQrError, setShareQrError] = useState("");
  const [shareQrBusy, setShareQrBusy] = useState(false);
  const [shareQrNotice, setShareQrNotice] = useState("");
  const payQrRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    let alive = true;
    setPayQr("");
    setPayQrAlias(null);
    setQrError("");
    setShareQrError("");
    setShareQrNotice("");
    if (!walletAddress) return () => { alive = false; };
    void getSignedPayQr().then((result) => {
      if (!alive) return;
      if (result.address.toLowerCase() === walletAddress.toLowerCase()) {
        setPayQr(result.payload);
        setPayQrAlias(result.alias);
      } else {
        setQrError("The account QR did not match your current wallet. Refresh your account session.");
      }
    }).catch((error: unknown) => {
      if (alive) setQrError(error instanceof Error ? error.message : "Signed payment QR is unavailable.");
    });
    return () => { alive = false; };
  }, [walletAddress]);

  async function copyAddress() {
    if (!walletAddress) { setNotice("Account wallet address is not available. Sign in again."); return; }
    try {
      await copyText(walletAddress);
      setNotice("Monad Testnet receiving address copied.");
    } catch {
      setNotice("Clipboard access is unavailable. Select and copy the address manually.");
    }
  }

  async function retryPayQr() {
    if (!walletAddress) return;
    setQrError("");
    setPayQr("");
    try {
      const result = await getSignedPayQr();
      if (result.address.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error("The account QR did not match your current wallet. Refresh your account session.");
      }
      setPayQr(result.payload);
      setPayQrAlias(result.alias);
    } catch (error) {
      setQrError(error instanceof Error ? error.message : "Signed payment QR is still unavailable.");
    }
  }

  function shareIdentityText() {
    const alias = displayAlias(accountAlias || payQrAlias);
    const identity = alias ? "Alias: " + alias : "Name: " + (displayName.trim() || "Subtle Pay");
    return [
      "Subtle Pay · Monad Testnet",
      identity,
      "Wallet address: " + (walletAddress || ""),
      "Network: Monad Testnet (Chain ID 10143)",
      "Only send native testnet MON to this address. Testnet tokens have no cash value."
    ].join("\n");
  }

  async function createShareQrFile(): Promise<File> {
    const svg = payQrRef.current;
    if (!svg || !payQr || !walletAddress) throw new Error("Your signed receiving QR is not ready yet.");
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const svgBlob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    try {
      const image = new Image();
      image.src = svgUrl;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("QR image could not be prepared."));
      });
      const canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = 920;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser cannot create a shareable QR image.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = "#e6eaf1";
      context.lineWidth = 2;
      context.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
      context.textAlign = "center";
      context.fillStyle = "#141824";
      context.font = "700 42px Arial, sans-serif";
      context.fillText("Subtle Pay", 360, 72);
      context.fillStyle = "#6b7280";
      context.font = "600 20px Arial, sans-serif";
      context.fillText("RECEIVE ON MONAD TESTNET", 360, 108);
      const alias = displayAlias(accountAlias || payQrAlias);
      if (alias) {
        context.fillStyle = "#141824";
        context.font = "700 29px Arial, sans-serif";
        context.fillText(alias, 360, 156, 650);
      } else if (displayName.trim()) {
        context.fillStyle = "#141824";
        context.font = "700 28px Arial, sans-serif";
        context.fillText(displayName.trim().slice(0, 30), 360, 156, 650);
      }
      context.drawImage(image, 170, 185, 380, 380);
      context.fillStyle = "#141824";
      context.font = "600 17px Arial, sans-serif";
      context.fillText("WALLET ADDRESS", 360, 610);
      context.fillStyle = "#333844";
      context.font = "16px monospace";
      context.fillText(walletAddress.slice(0, 21), 360, 644);
      context.fillText(walletAddress.slice(21), 360, 672);
      context.fillStyle = "#6b7280";
      context.font = "600 16px Arial, sans-serif";
      context.fillText("Monad Testnet · Chain ID 10143", 360, 730);
      context.fillStyle = "#8b3131";
      context.font = "14px Arial, sans-serif";
      context.fillText("Testnet only · Native MON transfers only", 360, 770);
      context.fillStyle = "#6b7280";
      context.font = "13px Arial, sans-serif";
      context.fillText("Verify the account details before sending.", 360, 808);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error("QR image export failed.")), "image/png");
      });
      return new File([blob], "subtle-pay-receive-qr.png", { type: "image/png" });
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }

  function downloadFile(file: File) {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function downloadShareQr() {
    setShareQrNotice("");
    setShareQrError("");
    setShareQrBusy(true);
    try {
      const file = await createShareQrFile();
      downloadFile(file);
      setShareQrNotice("QR card downloaded. Attach the PNG in WhatsApp, Instagram, or any app.");
    } catch (error) {
      setShareQrError(error instanceof Error ? error.message : "The QR card could not be downloaded.");
    } finally {
      setShareQrBusy(false);
    }
  }

  async function shareMyQr() {
    setShareQrNotice("");
    setShareQrError("");
    setShareQrBusy(true);
    try {
      const file = await createShareQrFile();
      const text = shareIdentityText();
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "My Subtle Pay receiving QR", text, files: [file] });
        setShareQrNotice("Your QR card and receiving details were shared.");
      } else {
        downloadFile(file);
        if (navigator.share) {
          try {
            await navigator.share({ title: "My Subtle Pay receiving details", text });
          } catch (error) {
            if (error instanceof Error && error.name === "AbortError") return;
            await copyText(text).catch(() => undefined);
          }
        } else {
          await copyText(text).catch(() => undefined);
        }
        setShareQrNotice("QR card downloaded. Share the PNG with the receiving details in your preferred app.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setShareQrError(error instanceof Error ? error.message : "Your QR card could not be shared.");
    } finally {
      setShareQrBusy(false);
    }
  }

  const qrLabel = displayAlias(accountAlias || payQrAlias) || displayName.trim() || "Subtle Pay";

  return <div className="page-stack inner-page receive-page">
    <div className="page-intro">
      <div>
        <div className="section-kicker">INCOMING TESTNET PAYMENTS</div>
        <h1>Receive money</h1>
        <p>Share your signed QR or wallet address to receive native MON on Monad Testnet.</p>
      </div>
      <span className="page-icon-bubble"><Icon name="receive" size={20} /></span>
    </div>

    {!walletAddress ? <section className="panel"><h2>Account wallet unavailable</h2><p>Sign in again to load your account wallet address.</p></section> : <>
      <section className="receive-hero-panel">
        <div className="receive-hero-copy">
          <span className="section-kicker light">YOUR SUBTLE PAY WALLET</span>
          <h2>Ready to <span>receive</span></h2>
          <p>Share this signed QR with the sender. Confirm they use Monad Testnet (chain ID 10143).</p>
          <div className="receive-hero-identity">
            <strong>{qrLabel}</strong>
            <small>Native MON · Testnet only</small>
          </div>
        </div>
        <div className="receive-qr-box receive-network-icon">
          {payQr ? <QRCodeSVG ref={payQrRef} value={payQr} size={176} level="H" includeMargin imageSettings={{ src: "/subtle-pay-mark.svg", width: 32, height: 32, excavate: true }} /> : <Icon name="qr" size={42} />}
          <span>MONAD TESTNET</span>
        </div>
      </section>

      <section className="panel address-panel">
        <div className="panel-heading compact">
          <div><div className="section-kicker">RECEIVING NETWORK</div><h2>Monad Testnet</h2></div>
          <span className="status-pill neutral">Chain 10143</span>
        </div>
        <div className="receive-address-label"><span>ACCOUNT WALLET ADDRESS</span></div>
        <div className="receive-full-address" title={walletAddress}>{walletAddress}</div>
        {qrError && <div className="inline-notice" role="status"><Icon name="info" size={16} /><span>{qrError}</span><button type="button" onClick={() => void retryPayQr()}>Retry</button></div>}
        <div className="receive-address-meta"><Icon name="shield" size={15} /><span>Backend-managed account wallet · Testnet only</span></div>
        <div className="button-row receive-action-row receive-qr-actions">
          <button type="button" className="primary-button" onClick={() => void shareMyQr()} disabled={!payQr || shareQrBusy}>
            <Icon name="share" size={16} />{shareQrBusy ? "Preparing…" : "Share receiving QR"}
          </button>
          <button type="button" className="secondary-button" onClick={() => void downloadShareQr()} disabled={!payQr || shareQrBusy}>
            <Icon name="download" size={16} />Download QR card
          </button>
          <button type="button" className="secondary-button" onClick={() => void copyAddress()}>
            <Icon name="copy" size={16} />Copy address
          </button>
        </div>
        <p className="receive-share-note">Share opens compatible apps when file sharing is supported. Otherwise, the QR card downloads so you can attach it manually.</p>
        {shareQrNotice && <div className="inline-notice success" role="status"><Icon name="check-circle" size={16} /><span>{shareQrNotice}</span><button type="button" aria-label="Dismiss" onClick={() => setShareQrNotice("")}><Icon name="close" size={14} /></button></div>}
        {shareQrError && <div className="inline-notice" role="alert"><Icon name="info" size={16} /><span>{shareQrError}</span><button type="button" aria-label="Dismiss" onClick={() => setShareQrError("")}><Icon name="close" size={14} /></button></div>}
        <div className="account-testnet-note">Only send native testnet MON in the hackathon build. Do not send real funds, mainnet tokens, or tokens from a different network to this testnet address.</div>
        {notice && <div className="inline-notice" role="status"><Icon name="info" size={16} /><span>{notice}</span></div>}
      </section>
    </>}

    <section className="panel">
      <div className="panel-heading compact"><div><div className="section-kicker">INBOUND ACTIVITY</div><h2>Incoming payments</h2></div></div>
      <p>Incoming payments from Subtle Pay accounts are listed in Activity after the backend records the transaction. Direct transfers from external wallets may change the on-chain balance without creating a Subtle Pay payment-history record.</p>
    </section>
  </div>;
}
