import type { WalletAsset } from "../services/walletService";

/**
 * Safe replacement for the old browser-side multichain/market-indexed widget.
 * It only renders native MON supplied by the authenticated backend wallet view.
 */
export interface TokenAssetsWidgetProps {
  holdings?: Array<Partial<WalletAsset> & { amount?: number; symbol?: string; name?: string; valueUsd?: number | null; network?: string }>;
  walletConnected?: boolean;
  pinned?: unknown[];
  apiKey?: string;
  baseUrl?: string;
  keyHeader?: string;
  currency?: string;
  refreshMs?: number;
  defaultTimeframe?: string;
  visibleHeld?: number;
  visibleTokens?: number;
  badge?: string | null;
  className?: string;
  onSelect?: (asset: unknown) => void;
  onConnectWallet?: () => void;
}

export default function TokenAssetsWidget({ holdings = [], walletConnected = false, className = "" }: TokenAssetsWidgetProps) {
  const nativeMon = holdings.filter((item) => item.symbol?.toUpperCase() === "MON" && !item.contractAddress && (item.network ?? item.chainLabel ?? "").toLowerCase().includes("monad testnet"));
  return (
    <section className={`panel ${className}`.trim()} aria-label="Monad Testnet assets">
      <div className="panel-heading compact"><div><div className="section-kicker">TESTNET ASSETS</div><h2>Monad Testnet</h2></div><span className="status-pill neutral">10143</span></div>
      {!walletConnected ? <p>Sign in to load the backend-managed Subtle Pay wallet.</p> : nativeMon.length === 0 ? <p>No native MON balance was returned by the backend yet. Refresh your account wallet to check again.</p> : nativeMon.map((asset, index) => (
        <div className="testnet-asset-row" key={asset.id ?? `mon-${index}`}><span><strong>{asset.name ?? "Monad Testnet MON"}</strong><small>Native testnet coin · no mainnet assets</small></span><span><strong>{(asset.amount ?? asset.balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 8 })} MON</strong>{asset.valueUsd != null && <small>≈ ${asset.valueUsd.toFixed(2)}</small>}</span></div>
      ))}
      <p className="account-testnet-note">Only native MON on Monad Testnet can be used for Subtle Pay payments. This component does not call external market APIs, browser wallets, or chain RPCs.</p>
    </section>
  );
}
