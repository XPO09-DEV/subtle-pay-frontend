import { useEffect, useState } from "react";
import Icon from "./Icon";
import { getPrimaryMarketHistory, getPrimaryMarketQuotes, type MarketHistory, type MarketPeriod, type MarketQuote, type PrimaryCoinId } from "../services/marketService";

const COINS: { key: PrimaryCoinId; name: string; symbol: string; description: string }[] = [
  { key: "tether", name: "Tether", symbol: "USDT", description: "USD-pegged stablecoin market reference" },
  { key: "usd-coin", name: "USD Coin", symbol: "USDC", description: "USD-pegged stablecoin market reference" },
  { key: "monad", name: "Monad", symbol: "MON", description: "Market reference only · testnet MON has no cash value" },
];
const PERIODS: { id: MarketPeriod; label: string }[] = [
  { id: "24h", label: "24H" }, { id: "1w", label: "7D" }, { id: "1m", label: "30D" }, { id: "3m", label: "90D" },
];
const money = (value: number) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: value < 1 ? 6 : value < 100 ? 4 : 2,
}).format(value);
const compactMoney = (value: number | null) => value == null ? "—" : value >= 1e12 ? "$" + (value / 1e12).toFixed(2) + "T" : value >= 1e9 ? "$" + (value / 1e9).toFixed(2) + "B" : value >= 1e6 ? "$" + (value / 1e6).toFixed(2) + "M" : money(value);

function PriceLine({ history, negative }: { history: MarketHistory; negative: boolean }) {
  const points = history.points;
  if (points.length < 2) return <div className="market-chart-empty">Not enough verified price points to draw this chart.</div>;
  const width = 720, height = 220, pad = 14;
  const values = points.map((point) => point.price);
  const min = Math.min(...values), max = Math.max(...values), range = max - min || Math.max(max * 0.001, 0.000001);
  const d = points.map((point, index) => {
    const x = pad + index * (width - pad * 2) / (points.length - 1);
    const y = height - pad - ((point.price - min) / range) * (height - pad * 2);
    return (index ? "L" : "M") + x.toFixed(2) + " " + y.toFixed(2);
  }).join(" ");
  const area = d + " L" + (width - pad) + " " + (height - pad) + " L" + pad + " " + (height - pad) + " Z";
  const latest = points[points.length - 1];
  const first = points[0];
  const delta = first.price ? ((latest.price - first.price) / first.price) * 100 : 0;
  return (
    <div className="market-chart-wrap">
      <div className="market-chart-summary">
        <span><strong>{money(latest.price)}</strong><small>Latest historical point</small></span>
        <span className={delta >= 0 ? "market-change up" : "market-change down"}>{delta >= 0 ? "+" : ""}{delta.toFixed(2)}% <small>in selected period</small></span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Real CoinStats historical price chart with ${points.length} points`} className={negative ? "market-chart is-down" : "market-chart"}>
        <defs><linearGradient id="marketPulseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".16"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>
        {[0.25, 0.5, 0.75].map((fraction) => <line key={fraction} x1={pad} x2={width - pad} y1={height * fraction} y2={height * fraction} className="market-grid-line" />)}
        <path d={area} fill="url(#marketPulseFill)" />
        <path d={d} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="market-chart-axis"><span>{new Date(first.time).toLocaleString()}</span><span>{new Date(latest.time).toLocaleString()}</span></div>
      <p className="market-chart-source">Historical prices returned by the backend's CoinStats integration · {points.length} points</p>
    </div>
  );
}

export default function MarketPulse() {
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [quotesBusy, setQuotesBusy] = useState(true);
  const [quotesError, setQuotesError] = useState("");
  const [activeCoin, setActiveCoin] = useState<PrimaryCoinId>("tether");
  const [period, setPeriod] = useState<MarketPeriod>("24h");
  const [history, setHistory] = useState<MarketHistory | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    let alive = true;
    let timer = 0;
    const refresh = async () => {
      try {
        const latest = await getPrimaryMarketQuotes();
        if (!alive) return;
        setQuotes(latest);
        setQuotesError(latest.length ? "" : "The market-data provider did not return USDT, USDC or MON quotes.");
      } catch (error) {
        if (!alive) return;
        setQuotesError(error instanceof Error ? error.message : "Market data is unavailable.");
      } finally {
        if (alive) setQuotesBusy(false);
      }
    };
    void refresh();
    timer = window.setInterval(() => { if (!document.hidden && navigator.onLine) void refresh(); }, 60_000);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false; window.clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const selected = quotes.find((coin) => coin.key === activeCoin);
  const changeNegative = (selected?.change24h ?? 0) < 0;
  useEffect(() => {
    let alive = true;
    setHistory(null);
    setHistoryError("");
    if (!selected) {
      setHistoryBusy(false);
      return () => { alive = false; };
    }
    setHistoryBusy(true);
    void getPrimaryMarketHistory(selected.id, period).then((value) => {
      if (alive) setHistory(value);
    }).catch((error: unknown) => {
      if (alive) setHistoryError(error instanceof Error ? error.message : "Historical prices are unavailable.");
    }).finally(() => { if (alive) setHistoryBusy(false); });
    return () => { alive = false; };
  }, [selected?.id, period]);

  return (
    <section className="panel market-pulse" aria-label="Primary coin prices and market history">
      <div className="panel-heading market-pulse-heading">
        <div><div className="section-kicker">MARKET WATCH</div><h2>Primary coin prices</h2><p>USDT · USDC · MON · updates every minute</p></div>
        <span className={quotesError ? "market-source-badge offline" : "market-source-badge"}><span />{quotesError ? "Feed unavailable" : quotesBusy ? "Connecting" : "CoinStats API"}</span>
      </div>
      <div className="market-primary-grid">
        {COINS.map((coin) => {
          const quote = quotes.find((item) => item.key === coin.key);
          const active = activeCoin === coin.key;
          return (
            <button type="button" key={coin.key} className={active ? "market-primary-card active" : "market-primary-card"} onClick={() => setActiveCoin(coin.key)} aria-pressed={active}>
              <span className={"market-coin-mark " + coin.symbol.toLowerCase()}>{coin.symbol.slice(0, 1)}</span>
              <span className="market-primary-copy"><strong>{coin.symbol}</strong><small>{coin.name}</small></span>
              <span className="market-primary-price">{quote ? money(quote.price) : quotesBusy ? "Loading…" : "Unavailable"}
                {quote?.change24h != null && <small className={quote.change24h >= 0 ? "up" : "down"}>{quote.change24h >= 0 ? "+" : ""}{quote.change24h.toFixed(2)}%</small>}
              </span>
            </button>
          );
        })}
      </div>
      {quotesError && <div className="market-inline-error" role="status"><Icon name="info" size={16}/><span>{quotesError} Make sure COINSTATS_API_KEY is configured in the backend .env file.</span></div>}
      <div className="market-detail-toolbar">
        <div><strong>{selected?.name ?? COINS.find((coin) => coin.key === activeCoin)?.name}</strong><span>{selected ? selected.symbol + " · USD market reference" : "Live quote pending"}</span></div>
        <div className="market-periods" role="group" aria-label="Price history period">
          {PERIODS.map((item) => <button type="button" key={item.id} className={period === item.id ? "selected" : ""} aria-pressed={period === item.id} onClick={() => setPeriod(item.id)}>{item.label}</button>)}
        </div>
      </div>
      {selected && <div className="market-stat-grid">
        <div><span>Market cap</span><strong>{compactMoney(selected.marketCap)}</strong></div>
        <div><span>24h volume</span><strong>{compactMoney(selected.volume24h)}</strong></div>
        <div><span>24h change</span><strong className={changeNegative ? "down" : "up"}>{selected.change24h == null ? "—" : (selected.change24h >= 0 ? "+" : "") + selected.change24h.toFixed(2) + "%"}</strong></div>
      </div>}
      {!selected && !quotesBusy && !quotesError && <p className="market-inline-error">No verified quote is available for this coin from the current market-data response.</p>}
      {historyBusy ? <div className="market-chart-skeleton"><span />Loading actual market history…</div>
        : historyError ? <div className="market-chart-empty" role="status"><Icon name="info" size={18}/><strong>Chart history unavailable</strong><span>{historyError}</span></div>
        : history ? <PriceLine history={history} negative={changeNegative} /> : !selected ? <div className="market-chart-empty">Waiting for a valid quote before requesting historical prices.</div> : null}
      <p className="market-testnet-disclaimer">Market prices are informational only. USDT and USDC are not sendable in this testnet build. Testnet MON has no cash value; the MON market quote is not the value of test tokens.</p>
    </section>
  );
}
