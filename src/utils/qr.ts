// Payment QR payloads are generated and signed by the backend. Never place an amount in a QR.
export type ScannedRecipient = {
  to: string;
  address?: string;
  chainId?: number;
  signedPayload?: string;
};

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

export function buildPayQR(handle: string | null | undefined, address: string, chainId?: number | null) {
  // Legacy display fallback only. The active Receive screen uses the signed server payload.
  const p = new URLSearchParams();
  if (handle) p.set("to", handle);
  p.set("addr", address);
  if (chainId) p.set("chain", String(chainId));
  return `subtlepay://pay?${p.toString()}`;
}

// Raw addresses remain scannable as generic wallet QR codes. Subtle Pay URIs require a signature.
export function parsePayQR(text: string): ScannedRecipient | null {
  const t = text.trim();
  if (ADDRESS.test(t)) return { to: t, address: t };

  const eth = t.match(/^ethereum:(?:pay-)?(0x[a-fA-F0-9]{40})(?:@(\d+))?/i);
  if (eth) {
    const chainId = eth[2] ? Number(eth[2]) : undefined;
    return { to: eth[1], address: eth[1], ...(chainId ? { chainId } : {}) };
  }

  try {
    const url = new URL(t);
    if (url.protocol !== "subtlepay:" || url.hostname !== "pay") return null;
    const address = url.searchParams.get("addr") || "";
    const to = url.searchParams.get("to") || address;
    const chainId = Number(url.searchParams.get("chain"));
    const issuedAt = Number(url.searchParams.get("iat"));
    const signature = url.searchParams.get("sig") || "";
    if (!ADDRESS.test(address) || !to || to.length > 80 || chainId !== 10143 ||
        !Number.isSafeInteger(issuedAt) || issuedAt <= 0 || !/^[a-fA-F0-9]{64}$/.test(signature)) {
      return null;
    }
    return { to, address, chainId, signedPayload: t };
  } catch {
    return null;
  }
}
