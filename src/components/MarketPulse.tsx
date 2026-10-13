import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react";
import Icon from "./Icon";
import { getPrimaryMarketHistory, getPrimaryMarketQuotes, type MarketHistory, type MarketPeriod, type MarketQuote, type PrimaryCoinId } from "../services/marketService";

const COINS: { key: PrimaryCoinId; name: string; symbol: string }[] = [
  { key: "tether", name: "Tether", symbol: "USDT" },
  { key: "usd-coin", name: "USD Coin", symbol: "USDC" },
  { key: "monad", name: "Monad", symbol: "MON" },
];
const PERIODS: { id: MarketPeriod; label: string }[] = [
  { id: "24h", label: "24H" }, { id: "1w", label: "7D" }, { id: "1m", label: "30D" }, { id: "3m", label: "90D" },
];
const money = (value: number) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: value < 1 ? 6 : value < 100 ? 4 : 2,
}).format(value);
const compactMoney = (value: number | null) => value == null ? "—" : value >= 1e12 ? "$" + (value / 1e12).toFixed(2) + "T" : value >= 1e9 ? "$" + (value / 1e9).toFixed(2) + "B" : value >= 1e6 ? "$" + (value / 1e6).toFixed(2) + "M" : money(value);

const CHART_HEIGHT = 124;

type ChartCoordinate = [number, number];

function thinHistory(points: MarketHistory["points"], max = 140): MarketHistory["points"] {
  if (points.length <= max) return points;
  const result: MarketHistory["points"] = [];
  for (let index = 0; index < max; index++) {
    result.push(points[Math.round((index / (max - 1)) * (points.length - 1))]);
  }
  return result;
}

function smoothLine(points: ChartCoordinate[]): string {
  if (points.length < 2) return "";
  let path = \`M\${points[0][0].toFixed(1)} \${points[0][1].toFixed(1)}\`;
  for (let index = 0; index < points.length - 1; index++) {
    const p0 = points[index - 1] ?? points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] ?? p2;
    path += \` C\${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} \${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)},\${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} \${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)},\${p2[0].toFixed(1)} \${p2[1].toFixed(1)}\`;
  }
  return path;
}

function formatAxisTime(time: number, period: MarketPeriod): string {
  const date = new Date(time);
  if (period === "24h") return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatHoverTime(time: number, period: MarketPeriod): string {
  const date = new Date(time);
  if (period === "24h") return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (period === "3m") return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    ...(period === "1w" ? { hour: "numeric" } : {}),
  });
}

function PriceLine({ history, period }: { history: MarketHistory; period: MarketPeriod }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  const [hover, setHover] = useState<number | null>(null);
  const gradientId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const points = useMemo(() => thinHistory(history.points), [history.points]);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const resizeObserver = new ResizeObserver(() => setWidth(element.clientWidth || 300));
    resizeObserver.observe(element);
    setWidth(element.clientWidth || 300);
    return () => resizeObserver.disconnect();
  }, []);

  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    const padTop = 10;
    const padBottom = 8;
    const padRight = 8;
    const values = points.map((point) => point.price);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const valueRange = maximum - minimum;
    const range = valueRange || 1;
    const coordinates: ChartCoordinate[] = points.map((point, index) => [
      (index / (points.length - 1)) * (width - padRight),
      valueRange === 0
        ? CHART_HEIGHT / 2
        : padTop + (1 - (point.price - minimum) / range) * (CHART_HEIGHT - padTop - padBottom),
    ]);
    const line = smoothLine(coordinates);
    const last = coordinates[coordinates.length - 1];
    return {
      coordinates,
      line,
      area: \`\${line} L\${last[0].toFixed(1)} \${CHART_HEIGHT} L0 \${CHART_HEIGHT} Z\`,
      last,
    };
  }, [points, width]);

  const axisLabels = useMemo(() => {
    if (points.length < 2) return [];
    return [0, 1, 2, 3].map((index) =>
      formatAxisTime(points[Math.round((index / 3) * (points.length - 1))].time, period),
    );
  }, [points, period]);

  function move(event: PointerEvent<HTMLDivElement>) {
    if (!geometry || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    let closest = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    geometry.coordinates.forEach((coordinate, index) => {
      const distance = Math.abs(coordinate[0] - x);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = index;
      }
    });
    setHover(closest);
  }

  const selectedIndex = hover == null ? points.length - 1 : Math.max(0, Math.min(hover, points.length - 1));
  const selectedPoint = points[selectedIndex];
  const firstPoint = points[0];
  const selectedCoordinate = geometry?.coordinates[selectedIndex] ?? null;
  const periodChange = firstPoint?.price
    ? ((selectedPoint.price - firstPoint.price) / firstPoint.price) * 100
    : 0;

  if (points.length < 2) {
    return <div className="market-chart-empty">Not enough verified price points to draw this chart.</div>;
  }

  return (
    <div className="market-chart-wrap">
      <div className="market-chart-summary">
        <span>
          <strong>{money(selectedPoint.price)}</strong>
          <small>{hover == null ? "Latest market price" : formatHoverTime(selectedPoint.time, period)}</small>
        </span>
        <span className={periodChange >= 0 ? "market-change up" : "market-change down"}>
          {periodChange >= 0 ? "+" : ""}{periodChange.toFixed(2)}%
          <small>{hover == null ? "in selected period" : "from period start"}</small>
        </span>
      </div>
      <div
        ref={wrapRef}
        className="ta-chart"
        onPointerMove={move}
        onPointerDown={move}
        onPointerLeave={() => setHover(null)}
        onPointerUp={() => setHover(null)}
        onPointerCancel={() => setHover(null)}
      >
        {geometry && (
          <svg width={width} height={CHART_HEIGHT} viewBox={\`0 0 \${width} \${CHART_HEIGHT}\`} role="img" aria-label={\`Historical price chart with \${history.points.length} real market data points\`}>
            <defs>
              <linearGradient id={\`g\${gradientId}\`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#4285F4" stopOpacity=".24" />
                <stop offset="1" stopColor="#4285F4" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((fraction) => (
              <line key={fraction} x1="0" x2={width} y1={CHART_HEIGHT * fraction} y2={CHART_HEIGHT * fraction} className="ta-grid" />
            ))}
            <g key={\`\${period}-\${points[0].time}-\${points[points.length - 1].time}\`}>
              <path d={geometry.area} fill={\`url(#g\${gradientId})\`} className="ta-area" />
              <path d={geometry.line} fill="none" stroke="#4285F4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="ta-line" />
            </g>
            {selectedCoordinate && hover != null ? (
              <>
                <line x1={selectedCoordinate[0]} x2={selectedCoordinate[0]} y1="0" y2={CHART_HEIGHT} className="ta-cross" />
                <circle cx={selectedCoordinate[0]} cy={selectedCoordinate[1]} r="8" fill="#4285F4" opacity=".16" />
                <circle cx={selectedCoordinate[0]} cy={selectedCoordinate[1]} r="4.5" fill="#4285F4" stroke="#fff" strokeWidth="2" />
              </>
            ) : geometry ? (
              <>
                <circle cx={geometry.last[0]} cy={geometry.last[1]} r="4" fill="#4285F4" className="ta-pulse" />
                <circle cx={geometry.last[0]} cy={geometry.last[1]} r="4.5" fill="#4285F4" stroke="#fff" strokeWidth="2" />
              </>
            ) : null}
          </svg>
        )}
      </div>
      <div className="ta-axis" aria-hidden="true">
        {axisLabels.map((label, index) => <span key={index}>{label}</span>)}
      </div>
      <p className="market-chart-source">Historical prices from the connected market-data service · {history.points.length} points</p>
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
        : history ? <PriceLine history={history} period={period} /> : !selected ? <div className="market-chart-empty">Waiting for a valid quote before requesting historical prices.</div> : null}
    </section>
  );
}
