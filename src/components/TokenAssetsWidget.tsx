import type { WalletAsset } from "../services/walletService";
import type { MarketQuote, PrimaryCoinId } from "../services/marketService";

export interface TokenAssetsWidgetProps {
  holdings?: WalletAsset[];
  walletConnected?: boolean;
  marketQuotes?: MarketQuote[];
  className?: string;
}

const TOKEN_ROWS: { key: PrimaryCoinId; symbol: string; name: string; description: string }[] = [
  { key: "tether", symbol: "USDT", name: "Tether", description: "Market quote · wallet transfer not enabled" },
  { key: "usd-coin", symbol: "USDC", name: "USD Coin", description: "Market quote · wallet transfer not enabled" },
  { key: "monad", symbol: "MON", name: "Monad", description: "Native Monad Testnet balance" },
];
const fmtAmount = (amount: number) => amount.toLocaleString(undefined, { maximumFractionDigits: 8 });
const fmtPrice = (amount: number) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: amount < 1 ? 6 : amount < 100 ? 4 : 2,
}).format(amount);

export default function TokenAssetsWidget({ holdings = [], walletConnected = false, marketQuotes = [], className = "" }: TokenAssetsWidgetProps) {
  const nativeMon = holdings.filter((item) => item.tokenSymbol?.toUpperCase() === "MON"
    && !item.contractAddress
    && item.chainLabel.toLowerCase().includes("monad testnet"));
  const monBalance = nativeMon.reduce((total, asset) => total + (Number(asset.balance) || 0), 0);

  return (
    <section className={`panel token-assets-panel ${className}`.trim()} aria-label="Token assets">
      <div className="panel-heading compact token-assets-heading">
        <div><div className="section-kicker">PORTFOLIO</div><h2>Token assets</h2><p>Live market quotes · refreshed every 60 seconds</p></div>
      </div>
      <div className="token-asset-list">
        {TOKEN_ROWS.map((token) => {
          const quote = marketQuotes.find((item) => item.key === token.key);
          const isNativeMon = token.key === "monad";
          return (
            <article className="token-asset-row" key={token.key}>
              <span className="token-asset-logo" aria-hidden="true">
                <span className="token-asset-logo-fallback">{token.symbol.slice(0, 1)}</span>
                {quote?.image && <img src={quote.image} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
              </span>
              <span className="token-asset-copy">
                <strong>{token.symbol}<span>{token.name}</span></strong>
                <small>{isNativeMon ? token.description : quote ? token.description : "Market quote unavailable"}</small>
                {quote && <small className={quote.change24h == null ? "token-asset-change neutral" : quote.change24h >= 0 ? "token-asset-change up" : "token-asset-change down"}>
                  {quote.change24h == null ? "24h change unavailable" : `${quote.change24h >= 0 ? "+" : ""}${quote.change24h.toFixed(2)}% · 24h`}
                </small>}
              </span>
              <span className="token-asset-value">
                {isNativeMon ? <>
                  <strong>{walletConnected ? fmtAmount(monBalance) + " MON" : "—"}</strong>
                  <small>{walletConnected ? "Account balance" : "Sign in to load balance"}</small>
                  {quote && <small className="token-asset-market-reference">Market ref. {fmtPrice(quote.price)}</small>}
                </> : <>
                  <strong>{quote ? fmtPrice(quote.price) : "—"}</strong>
                  <small>Market price</small>
                </>}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
