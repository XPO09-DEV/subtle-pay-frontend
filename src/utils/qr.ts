export type ScannedRecipient = {
  to: string;
  address?: string;
  chainId?: number;
  amount?: string;
  amountCurrency?: "USD" | "INR";
  /** Original signed payload must be verified by the backend before its recipient is trusted. */
  payload?: string;
};

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

/** Parse only the supported testnet QR shapes; signed Subtle Pay payloads are verified server-side. */
export function parsePayQR(text: string): ScannedRecipient | null {
  const t = text.trim();
  if (ADDRESS.test(t)) return { to: t, address: t, chainId: 10143 };
  const eth = t.match(/^ethereum:(?:pay-)?(0x[a-fA-F0-9]{40})(?:@(\d+))?/i);
  if (eth) {
    const chainId = eth[2] ? Number(eth[2]) : 10143;
    return chainId === 10143 ? { to: eth[1], address: eth[1], chainId } : null;
  }
  try {
    const u = new URL(t);
    if (u.protocol !== "subtlepay:" || u.hostname !== "pay") return null;
    const address = u.searchParams.get("addr") || "";
    const to = u.searchParams.get("to") || "";
    const chainId = Number(u.searchParams.get("chain"));
    const signature = u.searchParams.get("sig") || "";
    if (u.searchParams.get("v") !== "1" || chainId !== 10143 || !ADDRESS.test(address) || !to || !/^[a-f0-9]{64}$/i.test(signature)) return null;
    const amount = u.searchParams.get("amount") ?? undefined;
    const amountCurrency = u.searchParams.get("currency") ?? undefined;
    if (amount !== undefined && (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(amount) || Number(amount) <= 0 || (amountCurrency !== "USD" && amountCurrency !== "INR"))) return null;
    if (amount === undefined && amountCurrency !== undefined) return null;
    return { to, address, chainId, ...(amount ? { amount, amountCurrency: amountCurrency as "USD" | "INR" } : {}), payload: t };
  } catch {
    return null;
  }
}
