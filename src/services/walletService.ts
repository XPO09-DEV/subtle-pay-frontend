/** Frontend wallet helpers. Signing and chain RPC stay exclusively in the backend. */
export type WalletStatus = "disconnected" | "connecting" | "loading" | "ready" | "error";

export interface WalletAsset {
  id: string;
  blockchain: "monad-testnet";
  chainLabel: "Monad Testnet";
  tokenName: string;
  tokenSymbol: "MON" | "USDC";
  balance: number;
  balanceRawInteger?: string;
  balanceUsd: number | null;
  priceUsd: number | null;
  tokenDecimals: number;
  contractAddress: string | null;
  thumbnail: null;
  tokenType: "Native testnet coin" | "Configured testnet token";
}

const API_BASE_URL = ((import.meta.env.VITE_SUBTLEPAY_API_BASE_URL as string | undefined) ?? "")
  .trim()
  .replace(/\/+$/, "")
  // Backend routes are mounted at the origin root (for example /qr/pay, not /api/qr/pay).
  // Tolerate an accidental /api suffix in an existing local .env.local.
  .replace(/\/api$/i, "");

export function getBackendApiBaseUrl(): string {
  if (API_BASE_URL) return API_BASE_URL;
  if (typeof window === "undefined") return "";
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    // The Subtle Pay local stack uses backend :4055 with frontend :5174.
    if (window.location.port === "5174") return "http://127.0.0.1:4055";
    if (window.location.port === "5173") return `${window.location.protocol}//${window.location.hostname}:4000`;
  }
  return window.location.origin;
}

export function getChainLabel(chainId: string | number | null | undefined): string {
  if (chainId === 10143 || String(chainId).toLowerCase() === "0x279f" || String(chainId) === "10143") return "Monad Testnet";
  return "Monad Testnet (server-enforced)";
}

export function isValidEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Copy is unavailable in this browser.");
}
