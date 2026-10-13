
import { useEffect, useState, type FormEvent } from "react";
import Icon from "../components/Icon";
import QRScanner from "../components/QRScanner";

import {
  authorizePayment,
  getAccountRates,
  getMpinStatus,
  submitAccountPayment,
  type SendPaymentResult,

  verifyPayQr,
} from "../services/accountService";

import {
  isValidEvmAddress,
} from "../services/walletService";

import type { ScannedRecipient } from "../utils/qr";

type Currency = "INR" | "USD";

type SendProps = {
  onBack: () => void;
  initialRecipient?: string;
  walletAddress?: string | null;
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
  walletAddress = null,
  onTransactionSubmitted,
}: SendProps) {
  // Form state
  const [recipient, setRecipient] = useState(initialRecipient);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("INR");
  const [note, setNote] = useState("");

  // QR scanner state
  const [scanOpen, setScanOpen] = useState(false);
  const [scanNotice, setScanNotice] = useState("");

  // Quote and payment state
  const [rates, setRates] = useState<RatesState | null>(null);
  const [ratesError, setRatesError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SendPaymentResult | null>(null);
  const [mpinEnabled, setMpinEnabled] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMethod, setAuthMethod] = useState<"password" | "mpin">("password");
  const [authSecret, setAuthSecret] = useState("");
  const [authError, setAuthError] = useState("");

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
        if (verified.amount) { setAmount(verified.amount); if (verified.currency === "USD" || verified.currency === "INR") setCurrency(verified.currency); }
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
      ? (currency === "INR"
          ? amountNumber / rates.usdLocal
          : amountNumber) / rates.tokenUsd
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

    setAuthMethod(mpinEnabled ? "mpin" : "password");
    setAuthOpen(true);
  }

  async function authorizeAndSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authSecret) {
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
      const authorization = await authorizePayment(authMethod, authSecret, intent);
      const payment = await submitAccountPayment({
        ...intent,
        authorizationToken: authorization.authorizationToken,
      });
      setResult(payment);
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
            <option value="INR">Indian rupee (INR)</option>
            <option value="USD">US dollar (USD)</option>
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
                  currency === "INR"
                    ? `${fmt(
                        rates.tokenUsd * rates.usdLocal,
                        2
                      )} INR`
                    : `$${fmt(rates.tokenUsd, 4)}`
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
            {mpinEnabled && <button type="button" className={authMethod === "mpin" ? "selected" : ""} onClick={() => { setAuthMethod("mpin"); setAuthSecret(""); setAuthError(""); }}>6-digit MPIN</button>}
            <button type="button" className={authMethod === "password" ? "selected" : ""} onClick={() => { setAuthMethod("password"); setAuthSecret(""); setAuthError(""); }}>Account password</button>
          </div>
          <form onSubmit={(event) => void authorizeAndSubmit(event)}>
            <label className="field-label" htmlFor="payment-auth-secret">{authMethod === "mpin" ? "Enter your six-digit MPIN" : "Enter your account password"}</label>
            <input
              id="payment-auth-secret"
              className="form-input"
              type={authMethod === "mpin" ? "password" : "password"}
              inputMode={authMethod === "mpin" ? "numeric" : undefined}
              autoComplete={authMethod === "mpin" ? "one-time-code" : "current-password"}
              maxLength={authMethod === "mpin" ? 6 : 128}
              value={authSecret}
              onChange={(event) => { setAuthSecret(authMethod === "mpin" ? event.target.value.replace(/\D/g, "").slice(0, 6) : event.target.value); setAuthError(""); }}
              required
            />
            {authError && <p className="inline-notice" role="alert">{authError}</p>}
            <div className="payment-auth-actions">
              <button type="button" className="secondary-button" disabled={busy} onClick={() => { setAuthOpen(false); setAuthSecret(""); setAuthError(""); }}>Cancel</button>
              <button type="submit" className="primary-button" disabled={busy || !authSecret || (authMethod === "mpin" && authSecret.length !== 6)}>
                {busy ? "Authorizing…" : "Authorize & send"}
              </button>
            </div>
          </form>
          <p className="tiny-note">Device biometrics are not enabled in this build. Use MPIN or password until passkey enrollment is implemented.</p>
        </section>
      )}

      {notice && (
        <div
          className={result?.status === "confirmed" ? "inline-notice success" : "inline-notice"}
          role="status"
        >
          <Icon name={result?.status === "confirmed" ? "check-circle" : "info"} size={16} />
          <span>{notice}</span>
        </div>
      )}

      {result && (
        <section className="panel">
          <div className="panel-heading compact">
            <div>
              <div className="section-kicker">
                PAYMENT RESULT
              </div>
              <h2>{result.tokenAmount} MON</h2>
            </div>

            <span
              className={
                result.status === "confirmed"
                  ? "status-pill success"
                  : result.status === "failed"
                    ? "status-pill warning"
                    : "status-pill neutral"
              }
            >
              {result.status}
            </span>
          </div>

          <p>
            Transaction ID: <code>{result.txId}</code>
          </p>

          <p>
            Transaction hash:{" "}
            <code className="receive-full-address">
              {result.txHash}
            </code>
          </p>

          {result.txHash && (
            <a
              href={`https://testnet.monadexplorer.com/tx/${encodeURIComponent(
                result.txHash
              )}`}
              target="_blank"
              rel="noreferrer"
            >
              View on Monad Testnet Explorer ↗
            </a>
          )}
        </section>
      )}
    </div>
  );
}
