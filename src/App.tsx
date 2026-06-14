import { AlertTriangle, BarChart3, BookOpen, CircleUserRound, Database, Heart, LayoutDashboard, LineChart, Loader2, Menu, Moon, RefreshCw, Search, Settings, ShieldCheck, Sun, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Line, LineChart as ReLineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { glossary } from "./data/glossary";
import { formatPct, formatPrice, tone } from "./lib/format";
import { loadMarketBundle, MarketBundle } from "./lib/marketRepository";
import { buildPrediction } from "./lib/signals";
import { supabase } from "./lib/supabase";
import type { Asset } from "./types";

const navItems = [
  ["landing", "Launch", BarChart3],
  ["dashboard", "Dashboard", LayoutDashboard],
  ["search", "Asset Search", Search],
  ["predictions", "Predictions", LineChart],
  ["watchlists", "Watchlists", Heart],
  ["news", "News", BookOpen],
  ["learn", "Learn", BookOpen],
  ["account", "Account", CircleUserRound],
  ["admin", "Admin", ShieldCheck],
  ["settings", "Settings", Settings]
] as const;

const emptyBundle: MarketBundle = {
  assets: [],
  news: [],
  health: [],
  mode: "Unconfigured",
  message: "Market provider data has not been loaded yet. Add keys to GitHub Actions secrets, run ingestion, and connect Supabase."
};

type SettingsState = {
  theme: "dark" | "light";
  compact: boolean;
  beginner: boolean;
};

function loadSettings(): SettingsState {
  try {
    return { theme: "dark", compact: false, beginner: true, ...JSON.parse(localStorage.getItem("stocks-v2:settings") || "{}") };
  } catch {
    return { theme: "dark", compact: false, beginner: true };
  }
}

function saveSettings(settings: SettingsState) {
  localStorage.setItem("stocks-v2:settings", JSON.stringify(settings));
}

function useHashRoute() {
  const [hash, setHash] = useState(() => location.hash.replace(/^#\/?/, "") || "landing");
  useEffect(() => {
    const listener = () => setHash(location.hash.replace(/^#\/?/, "") || "landing");
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  const [route, symbol] = hash.split("/");
  return { route: navItems.some(([id]) => id === route) ? route : route === "asset" ? "asset" : "landing", symbol: decodeURIComponent(symbol || "") };
}

function go(route: string, symbol?: string) {
  location.hash = symbol ? `#/${route}/${encodeURIComponent(symbol)}` : `#/${route}`;
}

export function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [bundle, setBundle] = useState<MarketBundle>(emptyBundle);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const { route, symbol } = useHashRoute();

  useEffect(() => {
    document.documentElement.classList.toggle("light", settings.theme === "light");
    document.body.classList.toggle("compact", settings.compact);
    saveSettings(settings);
  }, [settings]);

  async function refresh() {
    setRefreshing(true);
    try {
      setBundle(await loadMarketBundle());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const selected = bundle.assets.find((asset) => asset.symbol === symbol) ?? bundle.assets[0];

  return (
    <div className={`app-shell ${navOpen ? "nav-open" : ""}`}>
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">SV2</div>
          <div>
            <strong>Stocks V2</strong>
            <span>Market Signal Deck</span>
          </div>
        </div>
        <nav className="nav-list">
          {navItems.map(([id, label, Icon]) => (
            <button key={id} className={`nav-link ${route === id ? "active" : ""}`} onClick={() => { setNavOpen(false); go(id); }}>
              <span>{label}</span>
              <Icon size={16} aria-hidden="true" />
            </button>
          ))}
        </nav>
        <section className="status-card" aria-label="Data status">
          <span className={`badge ${tone(bundle.mode)}`}>{bundle.mode}</span>
          <p>{bundle.message}</p>
        </section>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="icon-button mobile-only" type="button" aria-label="Open navigation" onClick={() => setNavOpen(true)}><Menu size={18} /></button>
          <AssetSearch assets={bundle.assets} />
          <div className="top-actions">
            <button className="ghost-button" type="button" onClick={refresh} disabled={refreshing}>
              {refreshing ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />} Refresh
            </button>
            <label className="toggle">
              <input checked={settings.beginner} type="checkbox" onChange={(event) => setSettings({ ...settings, beginner: event.target.checked })} />
              <span>Beginner</span>
            </label>
            <label className="toggle">
              <input checked={settings.compact} type="checkbox" onChange={(event) => setSettings({ ...settings, compact: event.target.checked })} />
              <span>Compact</span>
            </label>
            <button className="icon-button" type="button" aria-label="Toggle theme" onClick={() => setSettings({ ...settings, theme: settings.theme === "dark" ? "light" : "dark" })}>
              {settings.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>
        {navOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setNavOpen(false)}><X size={20} /></button>}
        <Ticker assets={bundle.assets} />
        <div className="safety-strip" role="note">
          Educational market research only. Nothing on this platform is financial advice. Market predictions are estimates and are not guarantees. Market data may be delayed, cached, estimated, or unavailable.
        </div>
        <div id="app" tabIndex={-1}>
          {loading ? <LoadingPage /> : <Route route={route} selected={selected} bundle={bundle} beginner={settings.beginner} />}
        </div>
      </main>
    </div>
  );
}

function AssetSearch({ assets }: { assets: Asset[] }) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => assets.filter((asset) => `${asset.symbol} ${asset.name}`.toLowerCase().includes(query.toLowerCase())).slice(0, 8), [assets, query]);
  function submit(event: FormEvent) {
    event.preventDefault();
    const found = matches[0];
    if (found) {
      setQuery("");
      go("asset", found.symbol);
    }
  }
  return (
    <form className="search" role="search" onSubmit={submit}>
      <label className="sr-only" htmlFor="search-input">Search ticker or asset</label>
      <input id="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search after provider ingestion..." autoComplete="off" />
      <button type="submit">Search</button>
      <div className={`suggestions ${query ? "open" : ""}`} role="listbox">
        {matches.length ? matches.map((asset) => (
          <button key={asset.symbol} className="suggestion" type="button" onClick={() => { setQuery(""); go("asset", asset.symbol); }}>
            <span><strong>{asset.symbol}</strong> {asset.name}</span><span>{asset.type}</span>
          </button>
        )) : <div className="suggestion muted">No provider rows loaded yet.</div>}
      </div>
    </form>
  );
}

function Ticker({ assets }: { assets: Asset[] }) {
  if (!assets.length) {
    return <section className="ticker-tape" aria-label="Market ticker"><span className="ticker-pill"><AlertTriangle size={16} /> No market ticker until GitHub Actions ingestion writes provider data.</span></section>;
  }
  return (
    <section className="ticker-tape" aria-label="Market ticker">
      {assets.map((asset) => <button className="ticker-pill" key={asset.symbol} onClick={() => go("asset", asset.symbol)}><strong>{asset.symbol}</strong><span>{formatPrice(asset.price)}</span><span className={tone(asset.changePct)}>{formatPct(asset.changePct)}</span></button>)}
    </section>
  );
}

function Route({ route, selected, bundle, beginner }: { route: string; selected?: Asset; bundle: MarketBundle; beginner: boolean }) {
  if (route === "asset") return selected ? <AssetPage asset={selected} beginner={beginner} /> : <EmptyMarket bundle={bundle} />;
  if (route === "dashboard") return <Dashboard bundle={bundle} />;
  if (route === "search") return <SearchPage bundle={bundle} />;
  if (route === "predictions") return <PredictionsPage bundle={bundle} />;
  if (route === "watchlists") return <WatchlistsPage bundle={bundle} />;
  if (route === "news") return <NewsPage bundle={bundle} />;
  if (route === "learn") return <LearnPage />;
  if (route === "account") return <AccountPage />;
  if (route === "admin") return <AdminPage bundle={bundle} />;
  if (route === "settings") return <SettingsPage />;
  return <LandingPage bundle={bundle} />;
}

function LandingPage({ bundle }: { bundle: MarketBundle }) {
  return (
    <section className="page">
      <div className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Market research command center</span>
          <h1>Stocks V2 Market Signal Deck</h1>
          <p className="lead">A GitHub Pages frontend wired for Supabase storage, GitHub Actions provider ingestion, immutable predictions, watchlists, glossary help, and protected admin workflows.</p>
          <div className="button-row">
            <button className="primary-button" onClick={() => go("dashboard")}>Explore Dashboard</button>
            <button className="ghost-button" onClick={() => go("admin")}>Provider Health</button>
            <button className="ghost-button" onClick={() => go("account")}>Create Account</button>
          </div>
        </div>
        <div className="hero-visual">
          <div className="row-between">
            <div><span className="eyebrow">Current data mode</span><h2>{bundle.mode}</h2></div>
            <span className={`badge ${tone(bundle.mode)}`}>{bundle.assets.length ? "Provider rows" : "No prices shown"}</span>
          </div>
          <EmptyChart />
          <div className="terminal-strip">
            <div><span>Assets loaded</span><strong>{bundle.assets.length}</strong></div>
            <div><span>News loaded</span><strong>{bundle.news.length}</strong></div>
            <div><span>Secret storage</span><strong>Actions</strong></div>
          </div>
        </div>
      </div>
      <Dashboard bundle={bundle} />
    </section>
  );
}

function Dashboard({ bundle }: { bundle: MarketBundle }) {
  if (!bundle.assets.length) return <EmptyMarket bundle={bundle} />;
  const gainers = [...bundle.assets].sort((a, b) => b.changePct - a.changePct).slice(0, 4);
  const active = [...bundle.assets].sort((a, b) => b.relativeVolume - a.relativeVolume).slice(0, 4);
  return (
    <section className="page">
      <div className="grid">
        <Panel title="Major Index Cards" subtitle="Live, delayed, or cached rows from Supabase.">
          <AssetGrid assets={bundle.assets.filter((asset) => asset.type === "Index").slice(0, 4)} />
        </Panel>
        <Panel title="Trending Assets" subtitle="Ranked by provider-backed movement and relative volume.">
          <AssetGrid assets={active} />
        </Panel>
        <Panel title="Top Gainers" subtitle="All values include source and freshness labels.">
          <AssetGrid assets={gainers} />
        </Panel>
        <Panel title="Recent Market News" subtitle="Headlines only; full copyrighted articles are not copied.">
          <NewsList bundle={bundle} />
        </Panel>
      </div>
    </section>
  );
}

function SearchPage({ bundle }: { bundle: MarketBundle }) {
  return (
    <section className="page">
      <h1>Asset Search</h1>
      <p className="lead">Search becomes provider-backed after GitHub Actions writes assets and quotes into Supabase.</p>
      {bundle.assets.length ? <AssetGrid assets={bundle.assets} /> : <EmptyMarket bundle={bundle} />}
    </section>
  );
}

function AssetPage({ asset, beginner }: { asset: Asset; beginner: boolean }) {
  const prediction = buildPrediction(asset);
  const chartData = asset.history.map((price, index) => ({ index: index + 1, price }));
  return (
    <section className="page">
      <div className="row-between">
        <div><span className="eyebrow">{asset.type} - {asset.exchange} - {asset.dataStatus}</span><h1>{asset.symbol} {asset.name}</h1><p className="lead">{asset.warning}</p></div>
        <div className="button-row"><button className="primary-button" onClick={() => saveWatch(asset.symbol)}>Add to Watchlist</button><button className="ghost-button">Create Alert</button></div>
      </div>
      <div className="grid">
        <Panel title="Price and Chart" subtitle={`${asset.provider} - updated ${new Date(asset.updatedAt).toLocaleString()}`}>
          <div className="metric-grid">
            <Metric label="Current price" value={formatPrice(asset.price)} />
            <Metric label="Change" value={formatPct(asset.changePct)} className={tone(asset.changePct)} />
            <Metric label="Signal" value={asset.signal} className={tone(asset.signal)} />
            <Metric label="Data" value={asset.dataStatus} className={tone(asset.dataStatus)} />
          </div>
          <div className="chart-card" aria-label={`${asset.symbol} historical price chart summary`}>
            <ResponsiveContainer width="100%" height={250}>
              <ReLineChart data={chartData}><XAxis dataKey="index" /><YAxis domain={["auto", "auto"]} /><Tooltip /><Line type="monotone" dataKey="price" stroke="#55a6ff" strokeWidth={3} dot={false} /></ReLineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Signal Inputs" subtitle={beginner ? "Plain-language mode explains why each indicator matters." : "Advanced score composition."}>
          <Score label="Technical" value={asset.technical} />
          <Score label="Momentum" value={asset.momentum} />
          <Score label="Sentiment" value={asset.sentiment} />
          <Score label="Risk" value={asset.risk} />
          <Score label="Data quality" value={asset.dataQuality} />
        </Panel>
        <Panel title="Prediction Estimate" subtitle="Stored predictions are never guaranteed financial advice.">
          <div className="metric-grid">
            <Metric label="Horizon" value={`${prediction.horizonDays} days`} />
            <Metric label="Direction" value={prediction.direction} className={tone(prediction.direction)} />
            <Metric label="Low" value={formatPrice(prediction.predictedLow)} />
            <Metric label="High" value={formatPrice(prediction.predictedHigh)} />
          </div>
          <p className="muted">{prediction.explanation}</p>
        </Panel>
      </div>
    </section>
  );
}

type NewsImpactRow = {
  id: string;
  news: MarketBundle["news"][number];
  asset?: Asset;
  impactScore: number;
  relevanceScore: number;
  sentimentScore: number;
  prediction?: ReturnType<typeof buildPrediction>;
  topic: string;
  freshness: string;
};

type PredictionTimeframe = "1d" | "3d" | "1w" | "2w" | "1m" | "3m" | "6m" | "1y";

const timeframeLabels: Record<PredictionTimeframe, string> = {
  "1d": "1 day",
  "3d": "3 days",
  "1w": "1 week",
  "2w": "2 weeks",
  "1m": "1 month",
  "3m": "3 months",
  "6m": "6 months",
  "1y": "1 year"
};

function PredictionsPage({ bundle }: { bundle: MarketBundle }) {
  const [symbol, setSymbol] = useState(bundle.assets[0]?.symbol ?? "");
  const [amount, setAmount] = useState("100");
  const [timeframe, setTimeframe] = useState<PredictionTimeframe>("1w");
  const [strategy, setStrategy] = useState("General outlook");
  const [riskTolerance, setRiskTolerance] = useState("Moderate");
  const [battleSymbols, setBattleSymbols] = useState([bundle.assets[0]?.symbol ?? "", bundle.assets[1]?.symbol ?? ""]);
  const [error, setError] = useState("");
  const assets = bundle.assets;

  if (!assets.length) return <EmptyMarket bundle={bundle} />;

  const selectedAsset = assets.find((asset) => asset.symbol.toUpperCase() === symbol.toUpperCase()) ?? assets[0];
  const investment = Number(amount);
  const prediction = selectedAsset ? buildPrediction(selectedAsset, timeframeToPredictionDays(timeframe)) : undefined;
  const model = prediction && Number.isFinite(investment) && investment > 0 ? predictionModel(selectedAsset, prediction, investment, timeframe, strategy, riskTolerance) : undefined;
  const ideas = assets.map((asset) => {
    const ideaPrediction = buildPrediction(asset, timeframeToPredictionDays(timeframe));
    return { asset, prediction: ideaPrediction, model: predictionModel(asset, ideaPrediction, investment > 0 ? investment : 100, timeframe, strategy, riskTolerance) };
  }).sort((a, b) => (b.model.safetyScore + b.model.possibleGainPct + b.asset.momentum * 0.2) - (a.model.safetyScore + a.model.possibleGainPct + a.asset.momentum * 0.2)).slice(0, 8);
  const battle = battleSymbols.map((entry) => assets.find((asset) => asset.symbol.toUpperCase() === entry.toUpperCase())).filter(Boolean) as Asset[];

  function runPrediction(event: FormEvent) {
    event.preventDefault();
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) {
      setError("Enter a stock, ETF, index, or crypto symbol.");
      return;
    }
    if (!assets.some((asset) => asset.symbol === normalized)) {
      setError(`${normalized} is not loaded from Supabase yet. Run ingestion for that symbol first.`);
      return;
    }
    if (!Number.isFinite(investment) || investment <= 0) {
      setError("Enter an investment amount greater than zero.");
      return;
    }
    setError("");
    setSymbol(normalized);
  }

  return (
    <section className="page command-page">
      <PageHeader
        eyebrow="Old-site inspired research builder"
        title="Market Predictions"
        text="Explore research estimates based on price action, momentum, volatility, market sentiment, news impact, historical patterns, risk, and data quality."
        note="Predictions are research estimates only. They cannot guarantee profit or prevent loss."
      />

      <section className="panel span-12 command-panel">
        <div className="panel-head">
          <div><h2>Prediction Builder</h2><p>Enter a symbol, money amount, timeframe, strategy, and risk tolerance.</p></div>
          <span className="badge warning">Research only</span>
        </div>
        <form className="prediction-form" onSubmit={runPrediction}>
          <label><span>Symbol</span><input value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} placeholder="AAPL, SPY, BTC" /></label>
          <label><span>Investment amount</span><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="100" /></label>
          <label><span>Timeframe</span><select value={timeframe} onChange={(event) => setTimeframe(event.target.value as PredictionTimeframe)}>{Object.entries(timeframeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label><span>Strategy</span><select value={strategy} onChange={(event) => setStrategy(event.target.value)}>{["General outlook", "Momentum", "Breakout", "Dip recovery", "News reaction", "Long-term trend", "Lower-risk setup", "High-growth setup"].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Risk tolerance</span><select value={riskTolerance} onChange={(event) => setRiskTolerance(event.target.value)}>{["Conservative", "Moderate", "Aggressive"].map((item) => <option key={item}>{item}</option>)}</select></label>
          <button className="primary-button" type="submit">Run Prediction</button>
        </form>
        {error && <p className="form-error">{error}</p>}
      </section>

      {model && prediction && (
        <section className="prediction-hero-grid">
          <Panel title="Safety Score" subtitle="Lower estimated risk does not mean guaranteed safe.">
            <div className="safety-dial" style={{ "--score": model.safetyScore } as React.CSSProperties}>
              <div><strong>{model.safetyScore}</strong><span>{model.riskLabel}</span></div>
            </div>
            <div className="metric-grid">
              <Metric label="Confidence" value={`${prediction.confidence}/100`} />
              <Metric label="Data quality" value={`${selectedAsset.dataQuality}/100`} />
              <Metric label="Volatility" value={`${selectedAsset.volatility}/100`} />
              <Metric label="Risk" value={`${selectedAsset.risk}/100`} className={tone(model.riskLabel)} />
            </div>
          </Panel>

          <Panel title={`${selectedAsset.symbol} Estimate`} subtitle={`${timeframeLabels[timeframe]} - ${strategy} - ${riskTolerance}`}>
            <div className="range-grid">
              <RangeBox toneClass="negative" title="Bearish or Low Case" value={money(model.lowEndingValue)} detail={`${money(model.possibleLoss)} (${formatPct(model.lossPct)})`} />
              <RangeBox toneClass="warning" title="Expected or Middle Case" value={money(model.expectedEndingValue)} detail={`${money(model.expectedChange)} (${formatPct(model.expectedPct)})`} />
              <RangeBox toneClass="positive" title="Bullish or High Case" value={money(model.highEndingValue)} detail={`${money(model.possibleGain)} (${formatPct(model.possibleGainPct)})`} />
            </div>
            <div className="metric-grid">
              <Metric label="Current price" value={formatPrice(selectedAsset.price)} />
              <Metric label="Predicted direction" value={prediction.direction} className={tone(prediction.direction)} />
              <Metric label="Predicted low" value={formatPrice(prediction.predictedLow)} />
              <Metric label="Predicted high" value={formatPrice(prediction.predictedHigh)} />
              <Metric label="Evaluation date" value={model.evaluationDate} />
              <Metric label="Provider" value={selectedAsset.provider} />
            </div>
          </Panel>
        </section>
      )}

      {model && prediction && (
        <section className="grid">
          <Panel title="Why The Model Thinks This" subtitle="Positive, negative, and uncertain factors are separated for readability.">
            <FactorList title="Positive Factors" items={model.positiveFactors} toneClass="positive" />
            <FactorList title="Negative Factors" items={model.negativeFactors} toneClass="negative" />
            <FactorList title="Neutral or Uncertain Factors" items={model.neutralFactors} toneClass="warning" />
          </Panel>
          <Panel title="What Would Invalidate This Prediction?" subtitle="Use invalidation levels before trusting any estimate.">
            <div className="definition-list">
              <div className="definition-row"><strong>Invalidation price</strong><span className="muted">{formatPrice(model.invalidationPrice)}</span></div>
              <div className="definition-row"><strong>Support failure</strong><span className="muted">A close below {formatPrice(selectedAsset.support)} weakens the setup.</span></div>
              <div className="definition-row"><strong>Resistance rejection</strong><span className="muted">Failure near {formatPrice(selectedAsset.resistance)} can cap upside.</span></div>
              <div className="definition-row"><strong>News reversal</strong><span className="muted">A strong negative headline cluster should trigger a fresh prediction version.</span></div>
              <div className="definition-row"><strong>Maximum reasonable loss estimate</strong><span className="muted">{money(model.possibleLoss)} based on this range model.</span></div>
            </div>
          </Panel>
        </section>
      )}

      <section className="panel span-12 command-panel">
        <div className="panel-head"><div><h2>Top Prediction Ideas</h2><p>Ranked by signal score, safety, possible upside, news impact, momentum, data quality, and risk.</p></div></div>
        <div className="idea-grid">
          {ideas.map((idea, index) => <PredictionIdeaCard key={idea.asset.symbol} rank={index + 1} asset={idea.asset} model={idea.model} prediction={idea.prediction} onView={() => { setSymbol(idea.asset.symbol); setError(""); }} />)}
        </div>
      </section>

      <section className="grid">
        <Panel title="Prediction Battle Cards" subtitle="Compare two loaded assets without declaring either a purchase recommendation.">
          <div className="prediction-form compact-form">
            <label><span>Asset A</span><input value={battleSymbols[0]} onChange={(event) => setBattleSymbols([event.target.value.toUpperCase(), battleSymbols[1]])} /></label>
            <label><span>Asset B</span><input value={battleSymbols[1]} onChange={(event) => setBattleSymbols([battleSymbols[0], event.target.value.toUpperCase()])} /></label>
          </div>
          <div className="battle-grid">
            {battle.map((asset) => {
              const p = buildPrediction(asset, timeframeToPredictionDays(timeframe));
              const m = predictionModel(asset, p, investment > 0 ? investment : 100, timeframe, strategy, riskTolerance);
              return <BattleCard key={asset.symbol} asset={asset} prediction={p} model={m} />;
            })}
          </div>
        </Panel>
        <Panel title="Prediction History and Track Record" subtitle="Stored prediction runs remain permanent for historical evaluation.">
          <div className="metric-grid">
            <Metric label="Loaded ideas" value={String(ideas.length)} />
            <Metric label="Open predictions" value={String(ideas.length)} />
            <Metric label="Completed predictions" value="Waiting" />
            <Metric label="Track record" value="Not enough data" className="warning" />
          </div>
          <div className="table-wrap responsive-table"><table><thead><tr><th>Asset</th><th>Direction</th><th>Range</th><th>Confidence</th><th>Safety</th><th>Status</th><th>Model</th></tr></thead><tbody>{ideas.map((idea) => <tr key={idea.asset.symbol}><td data-label="Asset">{idea.asset.symbol}</td><td data-label="Direction">{idea.prediction.direction}</td><td data-label="Range">{formatPrice(idea.prediction.predictedLow)} - {formatPrice(idea.prediction.predictedHigh)}</td><td data-label="Confidence">{idea.prediction.confidence}/100</td><td data-label="Safety">{idea.model.safetyScore}</td><td data-label="Status">Open</td><td data-label="Model">{idea.prediction.modelVersion}</td></tr>)}</tbody></table></div>
        </Panel>
      </section>
    </section>
  );
}

function WatchlistsPage({ bundle }: { bundle: MarketBundle }) {
  const [saved, setSaved] = useState<string[]>(() => JSON.parse(localStorage.getItem("stocks-v2:watchlist") || "[]"));
  const assets = bundle.assets.filter((asset) => saved.includes(asset.symbol));
  return (
    <section className="page">
      <h1>Watchlists</h1>
      <p className="lead">Guests are saved locally. Signed-in users can persist watchlists to Supabase with RLS ownership.</p>
      {assets.length ? <AssetGrid assets={assets} /> : <Panel title="No watchlist rows" subtitle="Add an asset after provider ingestion loads the supported universe."><p className="muted">Saved symbols: {saved.join(", ") || "None"}</p><button className="danger-button" onClick={() => { setSaved([]); localStorage.removeItem("stocks-v2:watchlist"); }}>Clear</button></Panel>}
    </section>
  );
}

function NewsPage({ bundle }: { bundle: MarketBundle }) {
  const [query, setQuery] = useState("");
  const [sentiment, setSentiment] = useState("All");
  const [impact, setImpact] = useState("All");
  const [source, setSource] = useState("All");
  const [sort, setSort] = useState("impact");
  const [selectedStory, setSelectedStory] = useState<NewsImpactRow | null>(null);
  const rows = useMemo(() => buildNewsRows(bundle), [bundle]);
  const sources = Array.from(new Set(rows.map((row) => row.news.source).filter((item): item is string => Boolean(item)))).slice(0, 18);
  const filtered = rows.filter((row) => {
    const haystack = `${row.news.headline} ${row.news.summary} ${row.asset?.symbol ?? ""} ${row.asset?.name ?? ""}`.toLowerCase();
    if (query && !haystack.includes(query.toLowerCase())) return false;
    if (sentiment !== "All" && row.news.sentiment !== sentiment) return false;
    if (impact !== "All" && impactLabel(row.impactScore) !== impact) return false;
    if (source !== "All" && row.news.source !== source) return false;
    return true;
  }).sort((a, b) => {
    if (sort === "recent") return new Date(b.news.publishedAt).getTime() - new Date(a.news.publishedAt).getTime();
    if (sort === "sentiment") return b.sentimentScore - a.sentimentScore;
    if (sort === "relevance") return b.relevanceScore - a.relevanceScore;
    return b.impactScore - a.impactScore;
  });
  const leaders = buildImpactLeaders(rows, bundle.assets).slice(0, 8);
  const bullish = rows.filter((row) => row.news.sentiment === "Positive").length;
  const bearish = rows.filter((row) => row.news.sentiment === "Negative").length;
  const highImpact = rows.filter((row) => row.impactScore >= 70).length;
  const averageSentiment = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.sentimentScore, 0) / rows.length) : 0;
  const lastUpdate = rows[0]?.news.publishedAt ? new Date(Math.max(...rows.map((row) => new Date(row.news.publishedAt).getTime()))).toLocaleString() : "Waiting";

  return (
    <section className="page command-page">
      <PageHeader
        eyebrow="Scanner news impact"
        title="News Impact Desk"
        text="See which headlines are affecting stocks, crypto, sectors, predictions, and market sentiment."
        note="Headlines, summaries, metadata, sentiment, and analysis are shown. Full copyrighted articles are not copied."
      />

      <section className="metric-grid news-summary-grid" aria-label="News market summary">
        <Metric label="Overall sentiment" value={averageSentiment ? `${averageSentiment}/100` : "Waiting"} className={averageSentiment >= 58 ? "positive" : averageSentiment <= 42 ? "negative" : "warning"} />
        <Metric label="Bullish stories" value={String(bullish)} className="positive" />
        <Metric label="Bearish stories" value={String(bearish)} className="negative" />
        <Metric label="High-impact stories" value={String(highImpact)} className="warning" />
        <Metric label="Assets receiving news" value={String(leaders.length)} />
        <Metric label="Most active topic" value={rows[0]?.topic ?? "Waiting"} className="cyan-text" />
        <Metric label="Last news update" value={lastUpdate} />
        <Metric label="Provider status" value={bundle.news.length ? "Connected" : "Waiting"} className={bundle.news.length ? "positive" : "warning"} />
      </section>

      <section className="panel span-12 command-panel">
        <div className="panel-head"><div><h2>Impact Leaders</h2><p>Assets currently receiving the strongest combined headline, sentiment, prediction, and price-action impact.</p></div></div>
        {leaders.length ? <div className="impact-leader-grid">{leaders.map((leader) => <ImpactLeaderCard key={leader.asset.symbol} leader={leader} />)}</div> : <p className="muted">No asset-linked news rows yet. More links will appear as ingestion stores broader headline metadata.</p>}
      </section>

      <section className="panel span-12 command-panel">
        <div className="panel-head">
          <div><h2>Headlines The Scanner Is Watching</h2><p>Compact provider cards with sentiment, relevance, estimated impact, and related prediction context.</p></div>
          <div className="toolbar">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search headlines or symbols" />
            <select value={sentiment} onChange={(event) => setSentiment(event.target.value)}><option>All</option><option>Positive</option><option>Negative</option><option>Neutral</option></select>
            <select value={impact} onChange={(event) => setImpact(event.target.value)}><option>All</option><option>High Impact</option><option>Moderate</option><option>Low Impact</option></select>
            <select value={source} onChange={(event) => setSource(event.target.value)}><option>All</option>{sources.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="impact">Most impact</option><option value="recent">Most recent</option><option value="sentiment">Sentiment score</option><option value="relevance">Most relevant</option></select>
            <button className="ghost-button" type="button" onClick={() => exportNewsRows(filtered)}>Export CSV</button>
          </div>
        </div>
        {filtered.length ? <div className="news-card-grid">{filtered.slice(0, 24).map((row) => <NewsImpactCard key={row.id} row={row} onOpen={() => setSelectedStory(row)} />)}</div> : <p className="muted">No provider news matches the current filters.</p>}
      </section>

      <section className="grid">
        <Panel title="News Impact Table" subtitle="Sortable, searchable, filterable scanner rows. Mobile converts rows into stacked cards.">
          <div className="table-wrap responsive-table"><table><thead><tr><th>Asset</th><th>Impact</th><th>Sentiment</th><th>Relevance</th><th>AI score</th><th>Confidence</th><th>Price</th><th>Move</th><th>Prediction</th><th>Risk</th><th>Headline</th><th>Source</th><th>Freshness</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id} onClick={() => setSelectedStory(row)}><td data-label="Asset"><strong>{row.asset?.symbol ?? "Market"}</strong><div className="tiny">{row.asset?.name ?? row.topic}</div></td><td data-label="Impact"><span className={`badge ${impactTone(row.impactScore)}`}>{row.impactScore} {impactLabel(row.impactScore)}</span></td><td data-label="Sentiment">{row.news.sentiment}</td><td data-label="Relevance">{row.relevanceScore}/100</td><td data-label="AI score">{row.prediction?.signalScore ?? "N/A"}</td><td data-label="Confidence">{row.prediction?.confidence ?? "N/A"}</td><td data-label="Price">{row.asset ? formatPrice(row.asset.price) : "N/A"}</td><td data-label="Move" className={row.asset ? tone(row.asset.changePct) : ""}>{row.asset ? formatPct(row.asset.changePct) : "N/A"}</td><td data-label="Prediction">{row.prediction?.direction ?? "Unlinked"}</td><td data-label="Risk">{row.asset?.risk ?? "N/A"}</td><td data-label="Headline">{row.news.headline}</td><td data-label="Source">{row.news.source}</td><td data-label="Freshness">{row.freshness}</td></tr>)}</tbody></table></div>
        </Panel>
        <Panel title="News Timeline and Duplicate Clusters" subtitle="Story publication, price moves, signal changes, and prediction changes are connected for later history.">
          <div className="tabs" aria-label="News timeline timeframe"><button className="active">Today</button><button>3 days</button><button>7 days</button><button>30 days</button><button>90 days</button></div>
          <div className="timeline-list">{filtered.slice(0, 8).map((row) => <div className="timeline-item" key={`${row.id}-timeline`}><span className={`timeline-dot ${impactTone(row.impactScore)}`} /><div><strong>{row.asset?.symbol ?? row.topic}</strong><p className="muted">{row.news.headline}</p><span className="tiny">{row.freshness} - price move {row.asset ? formatPct(row.asset.changePct) : "N/A"} - prediction {row.prediction?.direction ?? "unlinked"}</span></div></div>)}</div>
          <div className="definition-list">{clusterNews(filtered).slice(0, 4).map((cluster) => <div className="definition-row" key={cluster.key}><strong>{cluster.key}</strong><span className="muted">{cluster.count} source{cluster.count === 1 ? "" : "s"} - combined impact {cluster.impact}/100</span><span className="tiny">{cluster.sources.join(", ")}</span></div>)}</div>
        </Panel>
      </section>

      {selectedStory && <NewsDetailPanel row={selectedStory} onClose={() => setSelectedStory(null)} />}
    </section>
  );
}

function PageHeader({ eyebrow, title, text, note }: { eyebrow: string; title: string; text: string; note: string }) {
  return (
    <header className="command-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p className="lead">{text}</p>
      </div>
      <div className="command-note"><ShieldCheck size={18} /><span>{note}</span></div>
    </header>
  );
}

function RangeBox({ title, value, detail, toneClass }: { title: string; value: string; detail: string; toneClass: string }) {
  return <div className={`range-box ${toneClass}`}><span>{title}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function FactorList({ title, items, toneClass }: { title: string; items: string[]; toneClass: string }) {
  return (
    <div className="factor-block">
      <h3 className={toneClass}>{title}</h3>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </div>
  );
}

function PredictionIdeaCard({ rank, asset, prediction, model, onView }: { rank: number; asset: Asset; prediction: ReturnType<typeof buildPrediction>; model: ReturnType<typeof predictionModel>; onView: () => void }) {
  return (
    <article className={`idea-card ${prediction.direction.toLowerCase()}`}>
      <div className="idea-header">
        <div><span className="rank-badge">#{rank}</span><strong>{asset.symbol}</strong><p className="muted">{asset.name}</p></div>
        <div className="score-badge" style={{ "--score": model.safetyScore } as React.CSSProperties}>{model.safetyScore}</div>
      </div>
      <div className="pill-row">
        <span className={`badge ${tone(prediction.direction)}`}>{prediction.direction}</span>
        <span className="badge positive">Gain {formatPct(model.possibleGainPct)}</span>
        <span className="badge negative">Risk {formatPct(model.lossPct)}</span>
      </div>
      <Score label="Confidence" value={prediction.confidence} />
      <p className="muted"><strong>Main reason:</strong> {model.positiveFactors[0]}</p>
      <p className="muted"><strong>Main risk:</strong> {model.negativeFactors[0]}</p>
      <div className="button-row"><button className="primary-button" onClick={onView}>View Prediction</button><button className="ghost-button" onClick={() => saveWatch(asset.symbol)}>Add to Watchlist</button></div>
    </article>
  );
}

function BattleCard({ asset, prediction, model }: { asset: Asset; prediction: ReturnType<typeof buildPrediction>; model: ReturnType<typeof predictionModel> }) {
  return (
    <article className="battle-card">
      <div className="row-between"><strong>{asset.symbol}</strong><span className={`badge ${tone(prediction.direction)}`}>{prediction.direction}</span></div>
      <Metric label="Signal score" value={`${prediction.signalScore}/100`} />
      <Metric label="Confidence" value={`${prediction.confidence}/100`} />
      <Metric label="Safety" value={`${model.safetyScore}/100`} />
      <Metric label="News impact" value={`${newsProxyScore(asset)}/100`} />
      <Metric label="Possible upside" value={formatPct(model.possibleGainPct)} className="positive" />
      <Metric label="Possible downside" value={formatPct(model.lossPct)} className="negative" />
      <p className="tiny">{asset.symbol} appears stronger when signal, confidence, safety, and upside outweigh risk. This is not a purchase recommendation.</p>
    </article>
  );
}

function ImpactLeaderCard({ leader }: { leader: ReturnType<typeof buildImpactLeaders>[number] }) {
  const prediction = buildPrediction(leader.asset);
  return (
    <article className={`impact-leader-card ${impactTone(leader.impactScore)}`}>
      <div className="row-between"><div><strong>{leader.asset.symbol}</strong><p className="muted">{leader.asset.name}</p></div><span className={`badge ${impactTone(leader.impactScore)}`}>{leader.impactScore}</span></div>
      <div className="metric-grid">
        <Metric label="Price" value={formatPrice(leader.asset.price)} />
        <Metric label="Move" value={formatPct(leader.asset.changePct)} className={tone(leader.asset.changePct)} />
        <Metric label="Sentiment" value={leader.sentiment} className={tone(leader.sentiment)} />
        <Metric label="Confidence" value={`${prediction.confidence}/100`} />
      </div>
      <Score label="News impact" value={leader.impactScore} />
      <p className="muted">{leader.headline}</p>
      <div className="button-row"><button className="ghost-button" onClick={() => saveWatch(leader.asset.symbol)}>Add to Watchlist</button><button className="primary-button" onClick={() => go("asset", leader.asset.symbol)}>Open Asset</button></div>
    </article>
  );
}

function NewsImpactCard({ row, onOpen }: { row: NewsImpactRow; onOpen: () => void }) {
  return (
    <article className={`news-impact-card ${impactTone(row.impactScore)}`}>
      <div className="news-meta"><span className={`badge ${tone(row.news.sentiment)}`}>{row.news.sentiment}</span><span className="badge">{row.sentimentScore}/100</span><span className="badge">{row.topic}</span></div>
      <h3>{row.news.headline}</h3>
      <p className="tiny">{row.news.source} - {row.freshness}</p>
      <p className="muted">{row.news.summary || "Provider did not include a summary. The row is kept for impact tracking and source attribution."}</p>
      <div className="news-impact-footer">
        <Metric label="Impact" value={`${row.impactScore}/100`} />
        <Metric label="Relevance" value={`${row.relevanceScore}/100`} />
        <Metric label="Prediction" value={row.prediction?.direction ?? "Unlinked"} className={row.prediction ? tone(row.prediction.direction) : "warning"} />
      </div>
      <p className="muted"><strong>Why this matters:</strong> {whyStoryMatters(row)}</p>
      <div className="button-row"><button className="primary-button" onClick={onOpen}>Open Details</button>{row.news.url && <button className="ghost-button" onClick={() => window.open(row.news.url, "_blank", "noopener,noreferrer")}>Open Source</button>}<button className="ghost-button" onClick={() => saveStory(row.news.id)}>Save Story</button></div>
    </article>
  );
}

function NewsDetailPanel({ row, onClose }: { row: NewsImpactRow; onClose: () => void }) {
  return (
    <div className="detail-overlay" role="dialog" aria-modal="true" aria-label="News story details">
      <section className="detail-panel">
        <div className="row-between"><div><span className="eyebrow">News story details</span><h2>{row.news.headline}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close story details"><X size={18} /></button></div>
        <div className="metric-grid">
          <Metric label="Source" value={row.news.source} />
          <Metric label="Published" value={new Date(row.news.publishedAt).toLocaleString()} />
          <Metric label="Related asset" value={row.asset?.symbol ?? "Market-wide"} />
          <Metric label="Impact" value={`${row.impactScore}/100`} className={impactTone(row.impactScore)} />
          <Metric label="Sentiment" value={row.news.sentiment} className={tone(row.news.sentiment)} />
          <Metric label="Relevance" value={`${row.relevanceScore}/100`} />
        </div>
        <p className="lead">{row.news.summary}</p>
        <div className="grid">
          <Panel title="Why this matters" subtitle="Short scanner explanation."><p className="muted">{whyStoryMatters(row)}</p></Panel>
          <Panel title="Possible risks" subtitle="Risk notes for research context."><p className="muted">Headline sentiment can be wrong, duplicated, stale, or already priced in. Confirm with price, volume, and updated provider rows.</p></Panel>
          <Panel title="What to monitor next" subtitle="Follow-up conditions."><p className="muted">Watch price movement after publication, related headlines, signal changes, prediction confidence, and whether the story cluster keeps expanding.</p></Panel>
          <Panel title="Prediction connection" subtitle="Old predictions are not silently overwritten."><p className="muted">Current link: {row.prediction ? `${row.prediction.direction} with ${row.prediction.confidence}/100 confidence` : "No asset-linked prediction yet"}. A future backend event should create a new prediction version when news materially changes the setup.</p></Panel>
        </div>
      </section>
    </div>
  );
}

function timeframeToPredictionDays(timeframe: PredictionTimeframe): 7 | 14 | 30 {
  if (timeframe === "1d" || timeframe === "3d" || timeframe === "1w") return 7;
  if (timeframe === "2w") return 14;
  return 30;
}

function timeframeCalendarDays(timeframe: PredictionTimeframe) {
  return ({ "1d": 1, "3d": 3, "1w": 7, "2w": 14, "1m": 30, "3m": 90, "6m": 180, "1y": 365 } as Record<PredictionTimeframe, number>)[timeframe];
}

function predictionModel(asset: Asset, prediction: ReturnType<typeof buildPrediction>, amount: number, timeframe: PredictionTimeframe, strategy: string, riskTolerance: string) {
  const shares = amount / Math.max(asset.price, 0.01);
  const lowEndingValue = shares * prediction.predictedLow;
  const expectedEndingValue = shares * prediction.predictedPrice;
  const highEndingValue = shares * prediction.predictedHigh;
  const possibleLoss = Math.min(0, lowEndingValue - amount);
  const expectedChange = expectedEndingValue - amount;
  const possibleGain = Math.max(0, highEndingValue - amount);
  const safetyScore = clampNumber(Math.round(100 - asset.risk * 0.42 + asset.dataQuality * 0.22 + prediction.confidence * 0.18 - asset.volatility * 0.16), 1, 99);
  const riskLabel = safetyScore >= 75 ? "Lower estimated risk" : safetyScore >= 55 ? "Moderate estimated risk" : safetyScore >= 38 ? "Higher estimated risk" : "High risk";
  const evaluation = new Date();
  evaluation.setDate(evaluation.getDate() + timeframeCalendarDays(timeframe));
  const positiveFactors = [
    `${asset.momentum}/100 momentum and ${asset.technical}/100 technical score are part of the signal blend.`,
    `${prediction.confidence}/100 confidence with ${asset.dataQuality}/100 data quality.`,
    `${strategy} strategy is being evaluated against ${timeframeLabels[timeframe]} price range.`
  ];
  const negativeFactors = [
    `${asset.risk}/100 risk and ${asset.volatility}/100 volatility can widen the loss range.`,
    `A move below ${formatPrice(asset.support)} would weaken the current setup.`,
    `${riskTolerance} risk tolerance should still use a hard invalidation level.`
  ];
  const neutralFactors = [
    `News impact is estimated from available Supabase headlines and may be incomplete.`,
    `Sector and market-condition history needs more stored prediction outcomes for a stronger track record.`
  ];
  return {
    shares,
    lowEndingValue,
    expectedEndingValue,
    highEndingValue,
    possibleLoss,
    expectedChange,
    possibleGain,
    lossPct: amount ? possibleLoss / amount * 100 : 0,
    expectedPct: amount ? expectedChange / amount * 100 : 0,
    possibleGainPct: amount ? possibleGain / amount * 100 : 0,
    safetyScore,
    riskLabel,
    evaluationDate: evaluation.toLocaleDateString(),
    invalidationPrice: Math.min(asset.support, prediction.predictedLow),
    positiveFactors,
    negativeFactors,
    neutralFactors
  };
}

function buildNewsRows(bundle: MarketBundle): NewsImpactRow[] {
  return bundle.news.map((news) => {
    const asset = inferNewsAsset(news, bundle.assets);
    const sentimentScore = clampNumber(Math.round(news.sentimentScore || (news.sentiment === "Positive" ? 74 : news.sentiment === "Negative" ? 34 : 52)), 1, 100);
    const relevanceScore = news.impact === "High" ? 86 : news.impact === "Moderate" ? 64 : 42;
    const prediction = asset ? buildPrediction(asset) : undefined;
    const moveBoost = asset ? Math.min(18, Math.abs(asset.changePct) * 2.8) : 0;
    const predictionBoost = prediction ? prediction.confidence * 0.08 : 0;
    const impactScore = clampNumber(Math.round(36 + relevanceScore * 0.28 + Math.abs(sentimentScore - 50) * 0.35 + moveBoost + predictionBoost), 1, 99);
    return {
      id: news.id,
      news,
      asset,
      impactScore,
      relevanceScore,
      sentimentScore,
      prediction,
      topic: inferTopic(news),
      freshness: relativeTime(news.publishedAt)
    };
  });
}

function inferNewsAsset(news: MarketBundle["news"][number], assets: Asset[]) {
  const text = `${news.headline} ${news.summary}`.toLowerCase();
  return assets.find((asset) => text.includes(asset.symbol.toLowerCase()) || (asset.name.length > 3 && text.includes(asset.name.toLowerCase().split(" ")[0])));
}

function inferTopic(news: MarketBundle["news"][number]) {
  const text = `${news.headline} ${news.summary}`.toLowerCase();
  if (/earnings|revenue|profit|quarter/.test(text)) return "Earnings";
  if (/fed|inflation|jobs|rates|economy|economic/.test(text)) return "Economic";
  if (/analyst|upgrade|downgrade|price target/.test(text)) return "Analyst";
  if (/sec|doj|regulat|lawsuit/.test(text)) return "Regulatory";
  if (/bitcoin|crypto|coinbase|token/.test(text)) return "Crypto";
  if (/ai|chip|cloud|software|data/.test(text)) return "Technology";
  return news.category || "Market";
}

function buildImpactLeaders(rows: NewsImpactRow[], assets: Asset[]) {
  return assets.map((asset) => {
    const linked = rows.filter((row) => row.asset?.symbol === asset.symbol);
    const best = linked.sort((a, b) => b.impactScore - a.impactScore)[0];
    const impactScore = best ? best.impactScore : newsProxyScore(asset);
    return {
      asset,
      impactScore,
      sentiment: best?.news.sentiment ?? (asset.sentiment >= 58 ? "Positive" : asset.sentiment <= 42 ? "Negative" : "Neutral"),
      headline: best?.news.headline ?? "No direct headline cluster yet. Using current signal and price movement as a proxy.",
      storyCount: linked.length
    };
  }).filter((leader) => leader.storyCount || leader.impactScore >= 58).sort((a, b) => b.impactScore - a.impactScore);
}

function clusterNews(rows: NewsImpactRow[]) {
  const map = new Map<string, { key: string; count: number; impact: number; sources: string[] }>();
  for (const row of rows) {
    const key = row.asset?.symbol ?? row.topic;
    const current = map.get(key) ?? { key, count: 0, impact: 0, sources: [] };
    current.count += 1;
    current.impact = Math.max(current.impact, row.impactScore);
    if (!current.sources.includes(row.news.source)) current.sources.push(row.news.source);
    map.set(key, current);
  }
  return Array.from(map.values()).sort((a, b) => b.impact - a.impact);
}

function whyStoryMatters(row: NewsImpactRow) {
  if (!row.asset) return "This story is tracked as market-wide until the backend links it to specific assets.";
  const direction = row.prediction?.direction ?? "Neutral";
  return `${row.asset.symbol} is moving ${formatPct(row.asset.changePct)} while this story has ${row.impactScore}/100 estimated impact. The related prediction is ${direction.toLowerCase()}, so the scanner flags whether news supports or conflicts with the setup.`;
}

function exportNewsRows(rows: NewsImpactRow[]) {
  const header = ["Asset", "Headline", "Source", "Sentiment", "Impact", "Relevance", "Published"];
  const csv = [header, ...rows.map((row) => [row.asset?.symbol ?? "Market", row.news.headline, row.news.source, row.news.sentiment, String(row.impactScore), String(row.relevanceScore), row.news.publishedAt])].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "news-impact-rows.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function saveStory(id: string) {
  const saved = JSON.parse(localStorage.getItem("stocks-v2:saved-stories") || "[]") as string[];
  if (!saved.includes(id)) saved.push(id);
  localStorage.setItem("stocks-v2:saved-stories", JSON.stringify(saved));
}

function impactLabel(score: number) {
  if (score >= 70) return "High Impact";
  if (score >= 45) return "Moderate";
  return "Low Impact";
}

function impactTone(score: number) {
  if (score >= 70) return "positive";
  if (score <= 38) return "negative";
  return "warning";
}

function newsProxyScore(asset: Asset) {
  return clampNumber(Math.round(asset.sentiment * 0.55 + asset.confidence * 0.2 + Math.abs(asset.changePct) * 4), 1, 99);
}

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function LearnPage() {
  return (
    <section className="page">
      <h1>Learn and Glossary</h1>
      <p className="lead">Beginner definitions are safe to ship without market data because they do not claim current prices.</p>
      <div className="definition-list">
        {glossary.map((term) => <article className="definition-row" key={term.term}><strong>{term.term}</strong><span className="muted">{term.shortDefinition}</span><span className="tiny">{term.category}</span></article>)}
      </div>
    </section>
  );
}

function AccountPage() {
  const configured = Boolean(supabase);
  return (
    <section className="page">
      <h1>Account</h1>
      <p className="lead">Supabase Auth supports email/password registration, verification, session persistence, password reset, and optional Google login when configured.</p>
      <Panel title="Authentication Status" subtitle={configured ? "Supabase public config is present." : "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for auth."}>
        <div className="toolbar"><input type="email" placeholder="Email" /><input type="password" placeholder="Password" /><button className="primary-button" disabled={!configured}>Sign In</button><button className="ghost-button" disabled={!configured}>Create Account</button></div>
      </Panel>
    </section>
  );
}

function AdminPage({ bundle }: { bundle: MarketBundle }) {
  return (
    <section className="page">
      <h1>Admin and System Health</h1>
      <p className="lead">This page never displays secret values. Use GitHub Actions manual workflows for ingestion, backfill, indicators, predictions, and evaluation.</p>
      <div className="grid">
        <Panel title="Provider Health" subtitle="Configured means the Actions workflow verified the provider and wrote status rows.">
          <div className="table-wrap"><table><thead><tr><th>Service</th><th>Status</th><th>Last success</th><th>Latency</th></tr></thead><tbody>{bundle.health.map((row) => <tr key={row.service}><td>{row.service}</td><td><span className={`badge ${tone(row.status)}`}>{row.status}</span></td><td>{row.lastSuccess}</td><td>{row.latencyMs ?? "N/A"}</td></tr>)}</tbody></table></div>
        </Panel>
        <Panel title="Actions Jobs" subtitle="Use repository secrets, never frontend variables, for private API keys.">
          <div className="job-list">
            {["ingest-market", "manual-backfill", "run-signals", "evaluate-predictions", "deploy-pages"].map((job) => <div className="job-row" key={job}><strong>{job}</strong><span className="tiny">Defined in .github/workflows.</span></div>)}
          </div>
        </Panel>
      </div>
    </section>
  );
}

function SettingsPage() {
  return <section className="page"><h1>Settings</h1><p className="lead">Theme, beginner mode, compact mode, default watchlist, and notifications are available through the top controls and Supabase settings table.</p></section>;
}

function AssetGrid({ assets }: { assets: Asset[] }) {
  if (!assets.length) return <p className="muted">No provider rows match this section.</p>;
  return <div className="asset-grid">{assets.map((asset) => <article className="asset-card" key={asset.symbol} onClick={() => go("asset", asset.symbol)} tabIndex={0}><div className="asset-top"><div><div className="symbol">{asset.symbol}</div><span className="muted">{asset.name}</span></div><span className={`badge ${tone(asset.signal)}`}>{asset.signal}</span></div><div className="asset-bottom"><strong>{formatPrice(asset.price)}</strong><span className={tone(asset.changePct)}>{formatPct(asset.changePct)}</span></div><div className="tiny">{asset.type} - {asset.provider} - {asset.dataStatus}</div></article>)}</div>;
}

function NewsList({ bundle }: { bundle: MarketBundle }) {
  if (!bundle.news.length) return <Panel title="No provider news loaded" subtitle="Run the ingestion workflow after configuring news provider secrets."><p className="muted">No fabricated headlines are displayed.</p></Panel>;
  return <div className="job-list">{bundle.news.map((item) => <article className="job-row" key={item.id}><div className="row-between"><strong>{item.headline}</strong><span className={`badge ${tone(item.sentiment)}`}>{item.sentiment}</span></div><span className="tiny">{item.source} - {new Date(item.publishedAt).toLocaleString()}</span><p className="muted">{item.summary}</p></article>)}</div>;
}

function EmptyMarket({ bundle }: { bundle: MarketBundle }) {
  return (
    <section className="page">
      <div className="empty-state panel">
        <Database size={34} />
        <h1>No market data loaded yet</h1>
        <p className="lead">{bundle.message}</p>
        <div className="definition-list">
          <div className="definition-row"><strong>1. Add GitHub Actions secrets</strong><span className="muted">Store provider keys and Supabase service-role key under repository Actions secrets.</span></div>
          <div className="definition-row"><strong>2. Run migrations</strong><span className="muted">Create Supabase tables, RLS policies, public views, and glossary seed data.</span></div>
          <div className="definition-row"><strong>3. Run ingestion</strong><span className="muted">The scheduled workflow fetches provider data, normalizes it, and writes Supabase rows.</span></div>
        </div>
      </div>
    </section>
  );
}

function EmptyChart() {
  return <div className="empty-chart"><LineChart size={42} /><strong>Chart waiting for provider rows</strong><span>No sample candles or random prices are rendered.</span></div>;
}

function LoadingPage() {
  return <section className="page"><div className="panel"><Loader2 className="spin" size={24} /> Loading market configuration...</div></section>;
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <section className="panel span-6"><div className="panel-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div>{children}</section>;
}

function Metric({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return <div className="metric"><span>{label}</span><strong className={className}>{value}</strong></div>;
}

function Score({ label, value }: { label: string; value: number }) {
  return <div className="score-row"><div className="row-between"><strong>{label}</strong><span>{value}/100</span></div><div className="score-line"><span style={{ width: `${value}%` }} /></div></div>;
}

function saveWatch(symbol: string) {
  const saved = JSON.parse(localStorage.getItem("stocks-v2:watchlist") || "[]") as string[];
  if (!saved.includes(symbol)) saved.push(symbol);
  localStorage.setItem("stocks-v2:watchlist", JSON.stringify(saved));
}
