import { useState } from "react";
import Icon from "./Icon";
import { copyText } from "../services/walletService";
import type { SendPaymentResult } from "../services/accountService";
import "./PaymentReceipt.css";

type Currency = "INR" | "USD";

type Props = {
  result: SendPaymentResult;
  amount: string;
  currency: Currency;
  recipient: string;
  senderAddress: string | null;
  note: string;
  issuedAt: string;
};

function formatRequestedAmount(amount: string, currency: Currency): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount + " " + currency;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function statusDetails(status: string) {
  if (status === "confirmed") {
    return {
      label: "Confirmed",
      heading: "Payment confirmed",
      detail: "The backend reports that this transfer is confirmed on Monad Testnet.",
      className: "confirmed",
      icon: "check-circle" as const,
    };
  }
  if (status === "failed") {
    return {
      label: "Failed",
      heading: "Payment failed",
      detail: "The transfer was marked as failed. Check Activity before attempting it again.",
      className: "failed",
      icon: "x-circle" as const,
    };
  }
  return {
    label: status === "pending" ? "Pending" : "Submitted",
    heading: "Payment submitted",
    detail: "The transaction has been submitted. Its on-chain status may still be updating.",
    className: "pending",
    icon: "clock-3" as const,
  };
}

function ReceiptValue({ children }: { children: React.ReactNode }) {
  return <span className="payment-receipt-value">{children}</span>;
}

export default function PaymentReceipt({
  result,
  amount,
  currency,
  recipient,
  senderAddress,
  note,
  issuedAt,
}: Props) {
  const [copied, setCopied] = useState<"reference" | "hash" | "sender" | null>(null);
  const state = statusDetails(result.status);
  const requestedAmount = formatRequestedAmount(amount, currency);
  const usdValue = Number(result.usdValue);
  const hasUsdValue = result.usdValue !== "" && Number.isFinite(usdValue);
  const explorerUrl = result.txHash
    ? "https://testnet.monadexplorer.com/tx/" + encodeURIComponent(result.txHash)
    : "";

  async function copy(value: string, field: "reference" | "hash" | "sender") {
    if (!value) return;
    try {
      await copyText(value);
      setCopied(field);
    } catch {
      setCopied(null);
    }
  }

  return (
    <section className="payment-receipt" aria-labelledby="payment-receipt-title">
      <header className="payment-receipt-header">
        <div className="payment-receipt-brand">
          <span className="payment-receipt-mark" aria-hidden="true">S</span>
          <span className="payment-receipt-brand-copy">
            <strong>Subtle Pay</strong>
            <small>PAYMENT RECEIPT</small>
          </span>
        </div>
        <span className={"payment-receipt-status " + state.className}>
          <Icon name={state.icon} size={15} />
          {state.label}
        </span>
        <h2 id="payment-receipt-title">{state.heading}</h2>
        <p>Receipt details for your Monad Testnet transfer.</p>
      </header>

      <div className="payment-receipt-amount">
        <span className="payment-receipt-eyebrow">SETTLEMENT AMOUNT</span>
        <div className="payment-receipt-token-amount">
          <strong>{result.tokenAmount || "—"}</strong>
          <span>MON</span>
        </div>
        <p className="payment-receipt-requested">
          Requested {requestedAmount}
        </p>
        {hasUsdValue && (
          <span className="payment-receipt-usd-reference">
            USD reference: {new Intl.NumberFormat(undefined, {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 2,
            }).format(usdValue)}
          </span>
        )}
        <div className="payment-receipt-issued">
          <Icon name="calendar-clock" size={15} />
          <span>Receipt issued {formatDate(issuedAt)}</span>
        </div>
      </div>

      <div className="payment-receipt-details">
        <div className="payment-receipt-details-heading">
          <h3>Transfer details</h3>
          <span>TESTNET</span>
        </div>
        <dl>
          <div className="payment-receipt-row">
            <dt>Status</dt>
            <dd>
              <strong className={"payment-receipt-inline-status " + state.className}>{state.label}</strong>
              <small>{state.detail}</small>
            </dd>
          </div>
          <div className="payment-receipt-row">
            <dt>From</dt>
            <dd className="payment-receipt-break">
              {senderAddress || "Subtle Pay account wallet unavailable"}
              {senderAddress && (
                <button className="payment-receipt-copy" type="button" onClick={() => void copy(senderAddress, "sender")} aria-label="Copy sender wallet address">
                  <Icon name={copied === "sender" ? "check" : "copy"} size={14} />
                  {copied === "sender" ? "Copied" : "Copy"}
                </button>
              )}
            </dd>
          </div>
          <div className="payment-receipt-row">
            <dt>Recipient entered</dt>
            <dd className="payment-receipt-break">{recipient || "Not provided"}</dd>
          </div>
          <div className="payment-receipt-row">
            <dt>Requested amount</dt>
            <dd>{requestedAmount}</dd>
          </div>
          {note.trim() && (
            <div className="payment-receipt-row">
              <dt>Payment note</dt>
              <dd className="payment-receipt-break">{note.trim()}</dd>
            </div>
          )}
          <div className="payment-receipt-row">
            <dt>Network</dt>
            <dd>Monad Testnet <small>Chain ID 10143</small></dd>
          </div>
          <div className="payment-receipt-row">
            <dt>Settlement asset</dt>
            <dd>MON <small>Native testnet token</small></dd>
          </div>
          <div className="payment-receipt-row">
            <dt>Payment reference</dt>
            <dd className="payment-receipt-break">
              <code>{result.txId || "Unavailable"}</code>
              {result.txId && (
                <button className="payment-receipt-copy" type="button" onClick={() => void copy(result.txId, "reference")} aria-label="Copy payment reference">
                  <Icon name={copied === "reference" ? "check" : "copy"} size={14} />
                  {copied === "reference" ? "Copied" : "Copy"}
                </button>
              )}
            </dd>
          </div>
          <div className="payment-receipt-row payment-receipt-hash-row">
            <dt>Transaction hash</dt>
            <dd className="payment-receipt-break">
              {result.txHash ? <code>{result.txHash}</code> : "Not available yet"}
              {result.txHash && (
                <button className="payment-receipt-copy" type="button" onClick={() => void copy(result.txHash, "hash")} aria-label="Copy transaction hash">
                  <Icon name={copied === "hash" ? "check" : "copy"} size={14} />
                  {copied === "hash" ? "Copied" : "Copy"}
                </button>
              )}
            </dd>
          </div>
        </dl>
      </div>

      <footer className="payment-receipt-footer">
        <p>
          This receipt reflects the status returned by Subtle Pay. Use the Monad Testnet Explorer to verify on-chain details. Testnet tokens have no cash value.
        </p>
        <div className="payment-receipt-actions">
          <button type="button" className="payment-receipt-print" onClick={() => window.print()}>
            <Icon name="printer" size={16} />
            Print / Save PDF
          </button>
          {explorerUrl && (
            <a href={explorerUrl} target="_blank" rel="noreferrer" className="payment-receipt-explorer">
              View on Explorer
              <Icon name="arrow-up-right" size={14} />
            </a>
          )}
        </div>
      </footer>
    </section>
  );
}
