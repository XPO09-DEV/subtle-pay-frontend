// Our QR format: subtlepay://pay?to=ani@monad&addr=0x...&chain=10143
export function buildPayQR(
  handle: string | null | undefined,
  address: string,
  chainId?: number | null
) {
  const p = new URLSearchParams();
  if (handle) p.set("to", handle);
  p.set("addr", address);
  if (chainId) p.set("chain", String(chainId));
  return `subtlepay://pay?${p.toString()}`;
}

export type ScannedRecipient = { to: string; address?: string; chainId?: number };

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

// Returns who to pay, or null if the QR is not a payment QR we understand.
// It never returns an amount, so a scan can never decide how much is paid.
export function parsePayQR(text: string): ScannedRecipient | null {
  const t = text.trim();
  if (ADDRESS.test(t)) return { to: t, address: t };

  // Standard wallet QR: ethereum:0xabc...@10143?value=...  (address and chain only)
  const eth = t.match(/^ethereum:(?:pay-)?(0x[a-fA-F0-9]{40})(?:@(\d+))?/i);
  if (eth) return { to: eth[1], address: eth[1], chainId: eth[2] ? Number(eth[2]) : undefined };

  try {
    const u = new URL(t);
    if (u.protocol !== "subtlepay:") return null;
    const address = u.searchParams.get("addr") || undefined;
    const to = u.searchParams.get("to") || address;
    const chain = Number(u.searchParams.get("chain"));
    return to ? { to, address, chainId: chain > 0 ? chain : undefined } : null;
  } catch {
    return null;
  }
}