
import { useEffect, useRef, useState, type FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import Icon from "../components/Icon";
import PaymentReceipt from "../components/PaymentReceipt";
import QRScanner from "../components/QRScanner";

import {
  authorizePayment,
  authorizePaymentWithPasskey,
  getPasskeys,
  getSignedPayQr,
  getAccountRates,
  getSupportedCurrencies,
  getMpinStatus,
  submitAccountPayment,
  type SendPaymentResult,

  verifyPayQr,
} from "../services/accountService";

import {
  isValidEvmAddress,
} from "../services/walletService";

import type { ScannedRecipient } from "../utils/qr";
import { CURRENCIES } from "../data/currencies";

type Currency = string;

type SendProps = {
  onBack: () => void;
  initialRecipient?: string;
  preferredCurrency?: string;
  walletAddress?: string | null;
  accountAlias?: string | null;
  displayName?: string;
  walletChainId?: string | null;
  walletAssets?: unknown[];
  onConnectWallet?: () => void;
  onTransactionSubmitted?: () => void;
};

type RatesState = {
  tokenUsd: number;
  usdLocal: number;
};

function fmt(value: number, maximumFractionDigits = 6) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(value);
}

function statusCopy(status: string) {
  if (status === "confirmed") {
    return "Confirmed on Monad Testnet";
  }

  if (status === "failed") {
    return "The transaction failed on-chain";
  }

  if (status === "submitted" || status === "pending") {
    return "Submitted; confirmation is still pending";
  }

  return "Payment status received";
}

// Handles chain IDs expressed as either decimal or hexadecimal strings.

function normalizeChainId(
  value: string | number | null | undefined
): string {
  if (value == null || value === "") return "";

  try {
    return BigInt(value).toString();
  } catch {
    return String(value).toLowerCase();
  }
}


export default function Send({
  onBack,
  initialRecipient = "",
  preferredCurrency = "USD",
  walletAddress = null,
  accountAlias = null,
  displayName = "",
  onTransactionSubmitted,
}: SendProps) {
  // Form state
  const [recipient, setRecipient] = useState(initialRecipient);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>(preferredCurrency || "USD");
  const [currencies, setCurrencies] = useState<string[]>(["USD", "INR"]);
  const [note, setNote] = useState("");

  // QR scanner state
  const [scanOpen, setScanOpen] = useState(false);
  const [scanNotice, setScanNotice] = useState("");
  const [shareQrPayload, setShareQrPayload] = useState("");
  const [shareQrAlias, setShareQrAlias] = useState<string | null>(null);
  const [shareQrError, setShareQrError] = useState("");
  const [shareQrBusy, setShareQrBusy] = useState(false);
  const [shareQrNotice, setShareQrNotice] = useState("");
  const shareQrRef = useRef<SVGSVGElement | null>(null);

  // Quote and payment state
  const [rates, setRates] = useState<RatesState | null>(null);
  const [ratesError, setRatesError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SendPaymentResult | null>(null);
  const [receiptIssuedAt, setReceiptIssuedAt] = useState<string | null>(null);
  const [mpinEnabled, setMpinEnabled] = useState(false);
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMethod, setAuthMethod] = useState<"password" | "mpin" | "passkey">("password");
  const [authSecret, setAuthSecret] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let alive = true;
    void getSupportedCurrencies().then((items) => {
      if (!alive || items.length === 0) return;
      setCurrencies(CURRENCIES.filter((option) => items.includes(option.code.toUpperCase())).map((option) => option.code.toUpperCase()));
      if (preferredCurrency && items.includes(preferredCurrency) && CURRENCIES.some((option) => option.code.toUpperCase() === preferredCurrency)) setCurrency(preferredCurrency);
    }).catch(() => {
      if (alive) setCurrencies(["USD", "INR"]);
    });
    return () => { alive = false; };
  }, [preferredCurrency]);

  useEffect(() => {
    let alive = true;
    setShareQrPayload("");
    setShareQrAlias(null);
    setShareQrError("");
    setShareQrNotice("");
    if (!walletAddress) return () => { alive = false; };
    void getSignedPayQr().then((result) => {
      if (!alive) return;
      if (result.address.toLowerCase() !== walletAddress.toLowerCase()) {
        setShareQrError("The share QR doesn't match the currently signed-in wallet. Refresh your session and retry.");
        return;
      }
      setShareQrPayload(result.payload);
      setShareQrAlias(result.alias);
    }).catch((error: unknown) => {
      if (alive) setShareQrError(error instanceof Error ? error.message : "Your signed receiving QR could not be loaded.");
    });
    return () => { alive = false; };
  }, [walletAddress]);

  function shareIdentityText() {
    const alias = accountAlias || shareQrAlias;
    const identity = alias ? `Alias: @${alias.replace(/^@/, "").replace(/@monad$/i, "")}@monad` : `Name: ${displayName.trim() || "Subtle Pay"}`;
    return `Subtle Pay · Monad Testnet\n${identity}\nWallet address: ${walletAddress || ""}\nNetwork: Monad Testnet (Chain ID 10143)\nOnly send native testnet MON to this address. Testnet tokens have no cash value.`;
  }

  async function createShareQrFile(): Promise<File> {
    const svg = shareQrRef.current;
    if (!svg || !shareQrPayload || !walletAddress) throw new Error("The signed QR is not ready yet.");
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
      context.strokeStyle = "#e5e7eb";
      context.lineWidth = 2;
      context.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
      context.textAlign = "center";
      context.fillStyle = "#141824";
      context.font = "700 42px Arial, sans-serif";
      context.fillText("Subtle Pay", 360, 74);
      context.fillStyle = "#6b7280";
      context.font = "600 20px Arial, sans-serif";
      context.fillText("RECEIVE ON MONAD TESTNET", 360, 111);
      const alias = accountAlias || shareQrAlias;
      if (alias) {
        context.fillStyle = "#141824";
        context.font = "700 30px Arial, sans-serif";
        context.fillText("@" + alias.replace(/^@/, "").replace(/@monad$/i, "") + "@monad", 360, 158);
      } else if (displayName.trim()) {
        context.fillStyle = "#141824";
        context.font = "700 28px Arial, sans-serif";
        context.fillText(displayName.trim().slice(0, 28), 360, 158);
      }
      context.drawImage(image, 170, 185, 380, 380);
      context.fillStyle = "#141824";
      context.font = "600 18px Arial, sans-serif";
      context.fillText("WALLET ADDRESS", 360, 612);
      context.fillStyle = "#333844";
      context.font = "16px monospace";
      context.fillText(walletAddress.slice(0, 22), 360, 646);
      context.fillText(walletAddress.slice(22), 360, 674);
      context.fillStyle = "#6b7280";
      context.font = "600 16px Arial, sans-serif";
      context.fillText("Monad Testnet · Chain ID 10143", 360, 730);
      context.fillStyle = "#8b3131";
      context.font = "14px Arial, sans-serif";
      context.fillText("Testnet only · Native MON transfers only", 360, 770);
      context.fillStyle = "#6b7280";
      context.font = "13px Arial, sans-serif";
      context.fillText("Verify the account details before sending.", 360, 808);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("QR image export failed.")), "image/png"));
      return new File([blob], "subtle-pay-receive-qr.png", { type: "image/png" });
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }

  async function downloadShareQr() {
    setShareQrNotice("");
    setShareQrError("");
    setShareQrBusy(true);
    try {
      const file = await createShareQrFile();
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
      setShareQrNotice("Your QR card was downloaded. You can attach the PNG in WhatsApp, Instagram, or any app.");
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
        await navigator.share({ title: "My Subtle Pay QR", text, files: [file] });
        setShareQrNotice("Your QR card and wallet details were sent to the selected sharing app.");
      } else if (navigator.share) {
        await navigator.share({ title: "My Subtle Pay receiving details", text });
        setShareQrNotice("Your wallet details were shared. Download the QR card to attach the image in apps that don't support QR-image sharing.");
      } else {
        const url = URL.createObjectURL(file);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        link.click();
        URL.revokeObjectURL(url);
        await navigator.clipboard?.writeText(text).catch(() => undefined);
        setShareQrNotice("Your QR card was downloaded. Wallet details were copied when clipboard access was available; attach the PNG wherever you want to share it.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setShareQrError(error instanceof Error ? error.message : "Your QR card couldn't be shared.");
    } finally {
      setShareQrBusy(false);
    }
  }

  // Keep the recipient synchronized with navigation into this page.
  useEffect(() => {
    if (initialRecipient) {
      setRecipient(initialRecipient);
      setResult(null);
      setNotice("");
      setScanNotice("");
    }
  }, [initialRecipient]);

  useEffect(() => {
    let alive = true;
    void getMpinStatus().then((value) => { if (alive) setMpinEnabled(value.enabled); }).catch(() => {
      if (alive) setMpinEnabled(false);
    });
    void getPasskeys().then((items) => { if (alive) setPasskeyEnabled(items.length > 0); }).catch(() => { if (alive) setPasskeyEnabled(false); });
    return () => { alive = false; };
  }, []);

  // Fetch the current quote whenever the selected currency changes.
  useEffect(() => {
    let alive = true;

    setRates(null);
    setRatesError("");

    void getAccountRates(currency)
      .then((value) => {
        if (!alive) return;

        if (
          !Number.isFinite(value.tokenUsd) ||
          value.tokenUsd <= 0 ||
          !Number.isFinite(value.usdLocal) ||
          value.usdLocal <= 0
        ) {
          setRatesError("The rate service returned an invalid quote.");
          return;
        }

        setRates({
          tokenUsd: value.tokenUsd,
          usdLocal: value.usdLocal,
        });
      })
      .catch((error: unknown) => {
        if (!alive) return;

        setRatesError(
          error instanceof Error
            ? error.message
            : "A live payment quote is unavailable."
        );
      });

    return () => {
      alive = false;
    };
  }, [currency]);

  // Handle a recipient scanned from a payment QR code.
  async function handleScan(scanned: ScannedRecipient) {
    setScanOpen(false);
    if (scanned.payload) {
      try {
        const verified = await verifyPayQr(scanned.payload);
        if (!verified.valid || verified.chainId !== 10143 || !isValidEvmAddress(verified.address)) throw new Error("QR verification failed.");
        setRecipient(verified.address);
        if (verified.amount) { setAmount(verified.amount); if (verified.currency && currencies.includes(verified.currency)) setCurrency(verified.currency); }
        setResult(null); setNotice("");
        setScanNotice(`Verified Subtle Pay QR for Monad Testnet${verified.amount ? ` · ${verified.amount} ${verified.currency ?? "USD"}` : ""}. Review the recipient and amount before sending.`);
      } catch (error) { setScanNotice(error instanceof Error ? error.message : "This payment QR could not be verified by the backend."); }
      return;
    }
    const scannedAddress = scanned.address && isValidEvmAddress(scanned.address) ? scanned.address : "";
    const value = scannedAddress || scanned.to;
    if (!value || !value.trim()) { setScanNotice("This QR code does not contain a usable recipient. Enter the recipient manually."); return; }
    setRecipient(value.trim()); setResult(null); setNotice("");
    const scannedChainId = normalizeChainId(scanned.chainId);
    if (scannedChainId && scannedChainId !== "10143") setScanNotice("This QR is not for Monad Testnet (chain ID 10143). It cannot be used for a Subtle Pay payment.");
    else setScanNotice("Recipient filled from QR. Verify the details before continuing.");
  }
  const amountNumber = Number(amount);

  const validAmount =
    amount.trim() !== "" &&
    Number.isFinite(amountNumber) &&
    amountNumber > 0;

  const estimatedMon =
    rates && validAmount
      ? amountNumber / rates.usdLocal / rates.tokenUsd
      : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setResult(null);
    setAuthError("");
    setAuthSecret("");

    if (!walletAddress) {
      setNotice("Your Subtle Pay account wallet is unavailable. Sign in again before sending.");
      return;
    }
    if (!recipient.trim()) {
      setNotice("Enter a recipient account ID, Subtle Pay handle, or EVM address.");
      return;
    }
    if (!validAmount) {
      setNotice("Enter an amount greater than zero.");
      return;
    }
    if (!rates || ratesError) {
      setNotice("A live quote is unavailable. No payment was sent; retry when the rate service is available.");
      return;
    }

    setAuthMethod(passkeyEnabled ? "passkey" : mpinEnabled ? "mpin" : "password");
    setAuthOpen(true);
  }

  async function authorizeAndSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authMethod !== "passkey" && !authSecret) {
      setAuthError(authMethod === "mpin" ? "Enter your six-digit MPIN." : "Enter your account password.");
      return;
    }
    setBusy(true);
    setAuthError("");
    setNotice("");
    try {
      const intent = {
        to: recipient.trim(),
        amount,
        amountCurrency: currency,
        note: note.trim() || undefined,
        asset: "MON" as const,
      };
      const authorization = authMethod === "passkey"
        ? await authorizePaymentWithPasskey(intent)
        : await authorizePayment(authMethod, authSecret, intent);
      const payment = await submitAccountPayment({
        ...intent,
        authorizationToken: authorization.authorizationToken,
      });
      setResult(payment);
      setReceiptIssuedAt(new Date().toISOString());
      setNotice(statusCopy(payment.status));
      setAuthOpen(false);
      setAuthSecret("");
      onTransactionSubmitted?.();
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error.message : "Payment authorization or submission failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack inner-page send-page">
      <button
        className="back-link"
        type="button"
        onClick={onBack}
      >
        <Icon name="arrow-left" size={17} />
        Back to wallet
      </button>

      <div className="page-intro">
        <div>
          <div className="section-kicker">
            MONAD TESTNET PAYMENT
          </div>
          <h1>Send money</h1>
          <p>
            Payments are signed by your Subtle Pay account wallet
            and settle in native testnet MON.
          </p>
        </div>

        <span className="page-icon-bubble">
          <Icon name="send" size={20} />
        </span>
      </div>

      <div className="qr-tools">
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setScanNotice("");
            setScanOpen(true);
          }}
        >
          Scan QR
        </button>
      </div>

      <section className="panel send-share-qr-panel" aria-labelledby="send-share-qr-title">
        <div className="panel-heading compact">
          <div><div className="section-kicker">SHARE YOUR DETAILS</div><h2 id="send-share-qr-title">Your Subtle Pay QR</h2><p>Send your QR card and wallet details through WhatsApp, Instagram, or any app.</p></div>
          <Icon name="qr" size={21} />
        </div>
        {!walletAddress ? <p className="small-muted">Sign in to prepare your receiving QR.</p> : shareQrPayload ? <>
          <div className="send-share-qr-preview">
            <QRCodeSVG ref={shareQrRef} value={shareQrPayload} size={196} level="H" includeMargin />
            <strong>{accountAlias ? "@" + accountAlias.replace(/^@/, "").replace(/@monad$/i, "") + "@monad" : displayName.trim() || "Subtle Pay"}</strong>
            <span>{walletAddress}</span>
            <small>Monad Testnet · Chain ID 10143</small>
          </div>
          <p className="send-share-qr-note">This signed QR identifies your receiving wallet. Share the QR card and details together; only use it for Monad Testnet.</p>
          <div className="button-row send-share-qr-actions">
            <button type="button" className="primary-button" onClick={() => void shareMyQr()} disabled={shareQrBusy}><Icon name="arrow-up-right" size={16} />{shareQrBusy ? "Preparing…" : "Share QR"}</button>
            <button type="button" className="secondary-button" onClick={() => void downloadShareQr()} disabled={shareQrBusy}><Icon name="download" size={16} />Download QR card</button>
          </div>
        </> : <p className="small-muted">{shareQrError || "Preparing your secure receiving QR…"}</p>}
        {shareQrNotice && <div className="inline-notice success" role="status"><Icon name="check-circle" size={16} /><span>{shareQrNotice}</span><button type="button" aria-label="Dismiss" onClick={() => setShareQrNotice("")}><Icon name="close" size={14} /></button></div>}
        {shareQrError && shareQrPayload && <div className="inline-notice" role="alert"><Icon name="info" size={16} /><span>{shareQrError}</span><button type="button" aria-label="Dismiss" onClick={() => setShareQrError("")}><Icon name="close" size={14} /></button></div>}
      </section>

      {scanNotice && (
        <div className="inline-notice" role="status">
          <span>{scanNotice}</span>
          <button
            type="button"
            onClick={() => setScanNotice("")}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {scanOpen && (
        <QRScanner
          onClose={() => setScanOpen(false)}
          onScan={handleScan}
        />
      )}

      <section className="panel send-panel">
        <div className="send-connected-line">
          <span className="send-connected-dot" />

          <div>
            <strong>Subtle Pay account wallet</strong>
            <small>
              {walletAddress
                ? `${walletAddress.slice(0, 8)}…${walletAddress.slice(-6)} · Monad Testnet`
                : "Account wallet unavailable"}
            </small>
          </div>
        </div>

        <div className="account-testnet-note">
          Hackathon mode · Native MON on Monad Testnet only.
          Testnet tokens are not money and have no cash value.
          Other coins may be shown for market information but
          cannot be sent through this payment flow.
        </div>

        <form onSubmit={(event) => void submit(event)}>
          <div className="step-heading">
            <span className="step-number">01</span>
            <div>
              <h2>Recipient</h2>
              <p>
                Use an account ID, claimed Subtle Pay handle,
                or full EVM address.
              </p>
            </div>
          </div>

          <label
            className="field-label"
            htmlFor="payment-recipient"
          >
            Recipient
          </label>

          <div className="input-with-icon">
            <Icon name="user" size={18} />

            <input
              id="payment-recipient"
              value={recipient}
              onChange={(event) => {
                setRecipient(event.target.value);
                setResult(null);
                setNotice("");
                setScanNotice("");
              }}
              placeholder="Account ID, handle or 0x address"
              autoComplete="off"
              spellCheck={false}
              required
            />
          </div>

          <div className="step-heading send-step-heading">
            <span className="step-number">02</span>
            <div>
              <h2>Payment value</h2>
              <p>
                Enter a value to convert to MON using the
                backend&apos;s current market quote.
              </p>
            </div>
          </div>

          <label
            className="field-label"
            htmlFor="payment-currency"
          >
            Currency
          </label>

          <select
            id="payment-currency"
            className="form-select full-select"
            value={currency}
            onChange={(event) => {
              setCurrency(event.target.value as Currency);
              setResult(null);
              setNotice("");
            }}
          >
            {currency && !currencies.includes(currency) && <option value={currency}>Current saved preference — {currency}</option>}
            {currencies.map((code) => { const option = CURRENCIES.find((item) => item.code.toUpperCase() === code); return <option value={code} key={code}>{option ? `${option.symbol} ${option.name} (${code})` : code}</option>; })}
          </select>

          <label
            className="field-label"
            htmlFor="payment-amount"
          >
            Amount
          </label>

          <input
            id="payment-amount"
            className="form-input"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setResult(null);
              setNotice("");
            }}
            placeholder="0.00"
            required
          />

          <label
            className="field-label"
            htmlFor="payment-note"
          >
            Note (optional)
          </label>

          <input
            id="payment-note"
            className="form-input"
            value={note}
            onChange={(event) =>
              setNote(event.target.value.slice(0, 140))
            }
            maxLength={140}
            placeholder="What is this payment for?"
          />

          <div className="send-selected-asset">
            <span className="send-selected-asset-mark">
              <Icon name="coins" size={19} />
            </span>

            <span>
              <strong>MON · Monad Testnet</strong>
              <small>Settlement asset · Native token</small>
            </span>

            <span className="send-balance-copy">
              {estimatedMon == null
                ? "—"
                : `≈ ${fmt(estimatedMon, 8)} MON`}
              <small>Estimate only</small>
            </span>
          </div>

          <p className="account-gate-hint">
            {rates
              ? `Quote updated with the rate service. 1 MON ≈ ${
                  `${fmt(rates.tokenUsd * rates.usdLocal, 4)} ${currency}`
                }. The final sent amount is returned by the backend.`
              : ratesError || "Loading a current estimate…"}
          </p>

          <button
            className="primary-button"
            type="submit"
            disabled={
              busy ||
              !walletAddress ||
              !validAmount ||
              !rates ||
              Boolean(ratesError)
            }
          >
            {busy
              ? "Submitting payment…"
              : "Review and send testnet MON"}
          </button>
        </form>
      </section>

      {authOpen && (
        <section className="panel payment-auth-panel" aria-labelledby="payment-auth-title">
          <div className="panel-heading compact">
            <div><div className="section-kicker">PAYMENT SECURITY</div><h2 id="payment-auth-title">Authorize payment</h2></div>
            <span className="status-pill neutral">One-time</span>
          </div>
          <p>Confirm this payment with one required factor. Authorization expires after two minutes and can only be used once.</p>
          <div className="payment-auth-summary">
            <span>To <strong>{recipient.trim()}</strong></span>
            <span>Amount <strong>{amount || "0.00"} {currency}</strong></span>
            <span>Settlement <strong>Native MON · Monad Testnet</strong></span>
          </div>
          <div className="payment-auth-methods" role="group" aria-label="Payment authorization method">
            {passkeyEnabled && <button type="button" className={authMethod === "passkey" ? "selected" : ""} onClick={() => { setAuthMethod("passkey"); setAuthSecret(""); setAuthError(""); }}>Passkey / device biometric</button>}
            {mpinEnabled && <button type="button" className={authMethod === "mpin" ? "selected" : ""} onClick={() => { setAuthMethod("mpin"); setAuthSecret(""); setAuthError(""); }}>6-digit MPIN</button>}
            <button type="button" className={authMethod === "password" ? "selected" : ""} onClick={() => { setAuthMethod("password"); setAuthSecret(""); setAuthError(""); }}>Account password</button>
          </div>
          <form onSubmit={(event) => void authorizeAndSubmit(event)}>
            {authMethod === "passkey" ? <p className="account-gate-hint">Continue with your device's passkey prompt. Your browser or passkey provider may verify you with fingerprint, face recognition, or your device screen lock.</p> : <>
              <label className="field-label" htmlFor="payment-auth-secret">{authMethod === "mpin" ? "Enter your six-digit MPIN" : "Enter your account password"}</label>
              <input
                id="payment-auth-secret"
                className="form-input"
                type="password"
                inputMode={authMethod === "mpin" ? "numeric" : undefined}
                autoComplete={authMethod === "mpin" ? "one-time-code" : "current-password"}
                maxLength={authMethod === "mpin" ? 6 : 128}
                value={authSecret}
                onChange={(event) => { setAuthSecret(authMethod === "mpin" ? event.target.value.replace(/\D/g, "").slice(0, 6) : event.target.value); setAuthError(""); }}
                required
              />
            </>}
            {authError && <p className="inline-notice" role="alert">{authError}</p>}
            <div className="payment-auth-actions">
              <button type="button" className="secondary-button" disabled={busy} onClick={() => { setAuthOpen(false); setAuthSecret(""); setAuthError(""); }}>Cancel</button>
              <button type="submit" className="primary-button" disabled={busy || (authMethod !== "passkey" && !authSecret) || (authMethod === "mpin" && authSecret.length !== 6)}>
                {busy ? (authMethod === "passkey" ? "Waiting for device…" : "Authorizing…") : authMethod === "passkey" ? "Verify with passkey & send" : "Authorize & send"}
              </button>
            </div>
          </form>
          <p className="tiny-note">{passkeyEnabled ? "Passkey authorization uses a fresh server challenge bound to this exact payment and is valid only once. Your password and MPIN remain available as alternatives." : "Register a passkey in Settings to authorize payments using your device's native verification prompt."}</p>
        </section>
      )}

      {notice && !result && (
        <div
          className="inline-notice"
          role="status"
        >
          <Icon name="info" size={16} />
          <span>{notice}</span>
        </div>
      )}

      {result && receiptIssuedAt && (
        <PaymentReceipt
          result={result}
          amount={amount}
          currency={currency}
          recipient={recipient.trim()}
          senderAddress={walletAddress}
          note={note}
          issuedAt={receiptIssuedAt}
        />
      )}
    </div>
  );
}
