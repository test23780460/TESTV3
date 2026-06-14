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

type SettingsState = { theme: "dark" | "light"; compact: boolean; beginner: boolean; };

function loadSettings(): SettingsState {
  try { return { theme: "dark", compact: false, beginner: true, ...JSON.parse(localStorage.getItem("stocks-v2:settings") || "{}") }; }
  catch { return { theme: "dark", compact: false, beginner: true }; }
}

function saveSettings(settings: SettingsState) { localStorage.setItem("stocks-v2:settings", JSON.stringify(settings)); }

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

function go(route: string, symbol?: string) { location.hash = symbol ? `#/${route}/${encodeURIComponent(symbol)}` : `#/${route}`; }

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
    try { setBundle(await loadMarketBundle()); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { void refresh(); }, []);
  const selected = bundle.assets.find((asset) => asset.symbol === symbol) ?? bundle.assets[0];

  return (
    <div className={`app-shell ${navOpen ? "nav-open" : ""}`}>
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand"><div className="brand-mark" aria-hidden="true">SV2</div><div><strong>Stocks V2</strong><span>Market Signal Deck</span></div></div>
        <nav className="nav-list">{navItems.map(([id, label, Icon]) => <button key={id} className={`nav-link ${route === id ? "active" : ""}`} onClick={() => { setNavOpen(false); go(id); }}><span>{label}</span><Icon size={16} aria-hidden="true" /></button>)}</nav>
        <section className="status-card" aria-label="Data status"><span className={`badge ${tone(bundle.mode)}`}>{bundle.mode}</span><p>{bundle.message}</p></section>
      </aside>
      <main className="main">
        <header className="topbar">
          <button className="icon-button mobile-only" type="button" aria-label="Open navigation" onClick={() => setNavOpen(true)}><Menu size={18} /></button>
          <AssetSearch assets={bundle.assets} />
          <div className="top-actions">
            <button className="ghost-button" type="button" onClick={refresh} disabled={refreshing}>{refreshing ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />} Refresh</button>
            <label className="toggle"><input checked={settings.beginner} type="checkbox" onChange={(event) => setSettings({ ...settings, beginner: event.target.checked })} /><span>Beginner</span></label>
            <label className="toggle"><input checked={settings.compact} type="checkbox" onChange={(event) => setSettings({ ...settings, compact: event.target.checked })} /><span>Compact</span></label>
            <button className="icon-button" type="button" aria-label="Toggle theme" onClick={() => setSettings({ ...settings, theme: settings.theme === "dark" ? "light" : "dark" })}>{settings.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
          </div>
        </header>
        {navOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setNavOpen(false)}><X size={20} /></button>}
        <Ticker assets={bundle.assets} />
        <div className="safety-strip" role="note">Educational market research only. Nothing on this platform is financial advice. Market predictions are estimates and are not guarantees. Market data may be delayed, cached, estimated, or unavailable.</div>
        <div id="app" tabIndex={-1}>{loading ? <LoadingPage /> : <Route route={route} selected={selected} bundle={bundle} beginner={settings.beginner} />}</div>
      </main>
    </div>
  );
}

function AssetSearch({ assets }: { assets: Asset[] }) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => assets.filter((asset) => `${asset.symbol} ${asset.name}`.toLowerCase().includes(query.toLowerCase())).slice(0, 8), [assets, query]);
  function submit(event: FormEvent) { event.preventDefault(); const found = matches[0]; if (found) { setQuery(""); go("asset", found.symbol); } }
  return <form className="search" role="search" onSubmit={submit}><label className="sr-only" htmlFor="search-input">Search ticker or asset</label><input id="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search after provider ingestion..." autoComplete="off" /><button type="submit">Search</button><div className={`suggestions ${query ? "open" : ""}`} role="listbox">{matches.length ? matches.map((asset) => <button key={asset.symbol} className="suggestion" type="button" onClick={() => { setQuery(""); go("asset", asset.symbol); }}><span><strong>{asset.symbol}</strong> {asset.name}</span><span>{asset.type}</span></button>) : <div className="suggestion muted">No provider rows loaded yet.</div>}</div></form>;
}

function Ticker({ assets }: { assets: Asset[] }) {
  if (!assets.length) return <section className="ticker-tape" aria-label="Market ticker"><span className="ticker-pill"><AlertTriangle size={16} /> No market ticker until GitHub Actions ingestion writes provider data.</span></section>;
  return <section className="ticker-tape" aria-label="Market ticker">{assets.map((asset) => <button className="ticker-pill" key={asset.symbol} onClick={() => go("asset", asset.symbol)}><strong>{asset.symbol}</strong><span>{formatPrice(asset.price)}</span><span className={tone(asset.changePct)}>{formatPct(asset.changePct)}</span></button>)}</section>;
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

function LandingPage({ bundle }: { bundle: MarketBundle }) { return <section className="page"><div className="hero"><div className="hero-copy"><span className="eyebrow">Market research command center</span><h1>Stocks V2 Market Signal Deck</h1><p className="lead">A GitHub Pages frontend wired for Supabase storage, GitHub Actions provider ingestion, immutable predictions, watchlists, glossary help, and protected admin workflows.</p><div className="button-row"><button className="primary-button" onClick={() => go("dashboard")}>Explore Dashboard</button><button className="ghost-button" onClick={() => go("admin")}>Provider Health</button><button className="ghost-button" onClick={() => go("account")}>Create Account</button></div></div><div className="hero-visual"><div className="row-between"><div><span className="eyebrow">Current data mode</span><h2>{bundle.mode}</h2></div><span className={`badge ${tone(bundle.mode)}`}>{bundle.assets.length ? "Provider rows" : "No prices shown"}</span></div><EmptyChart /><div className="terminal-strip"><div><span>Assets loaded</span><strong>{bundle.assets.length}</strong></div><div><span>News loaded</span><strong>{bundle.news.length}</strong></div><div><span>Secret storage</span><strong>Actions</strong></div></div></div></div><Dashboard bundle={bundle} /></section>; }

function Dashboard({ bundle }: { bundle: MarketBundle }) { if (!bundle.assets.length) return <EmptyMarket bundle={bundle} />; const gainers = [...bundle.assets].sort((a, b) => b.changePct - a.changePct).slice(0, 4); const active = [...bundle.assets].sort((a, b) => b.relativeVolume - a.relativeVolume).slice(0, 4); return <section className="page"><div className="grid"><Panel title="Major Index Cards" subtitle="Live, delayed, or cached rows from Supabase."><AssetGrid assets={bundle.assets.filter((asset) => asset.type === "Index").slice(0, 4)} /></Panel><Panel title="Trending Assets" subtitle="Ranked by provider-backed movement and relative volume."><AssetGrid assets={active} /></Panel><Panel title="Top Gainers" subtitle="All values include source and freshness labels."><AssetGrid assets={gainers} /></Panel><Panel title="Recent Market News" subtitle="Headlines only; full copyrighted articles are not copied."><NewsList bundle={bundle} /></Panel></div></section>; }

function SearchPage({ bundle }: { bundle: MarketBundle }) { return <section className="page"><h1>Asset Search</h1><p className="lead">Search becomes provider-backed after GitHub Actions writes assets and quotes into Supabase.</p>{bundle.assets.length ? <AssetGrid assets={bundle.assets} /> : <EmptyMarket bundle={bundle} />}</section>; }

function AssetPage({ asset, beginner }: { asset: Asset; beginner: boolean }) { const prediction = buildPrediction(asset); const chartData = asset.history.map((price, index) => ({ index: index + 1, price })); return <section className="page"><div className="row-between"><div><span className="eyebrow">{asset.type} - {asset.exchange} - {asset.dataStatus}</span><h1>{asset.symbol} {asset.name}</h1><p className="lead">{asset.warning}</p></div><div className="button-row"><button className="primary-button" onClick={() => saveWatch(asset.symbol)}>Add to Watchlist</button><button className="ghost-button">Create Alert</button></div></div><div className="grid"><Panel title="Price and Chart" subtitle={`${asset.provider} - updated ${new Date(asset.updatedAt).toLocaleString()}`}><div className="metric-grid"><Metric label="Current price" value={formatPrice(asset.price)} /><Metric label="Change" value={formatPct(asset.changePct)} className={tone(asset.changePct)} /><Metric label="Signal" value={asset.signal} className={tone(asset.signal)} /><Metric label="Data" value={asset.dataStatus} className={tone(asset.dataStatus)} /></div><div className="chart-card" aria-label={`${asset.symbol} historical price chart summary`}><ResponsiveContainer width="100%" height={250}><ReLineChart data={chartData}><XAxis dataKey="index" /><YAxis domain={["auto", "auto"]} /><Tooltip /><Line type="monotone" dataKey="price" stroke="#55a6ff" strokeWidth={3} dot={false} /></ReLineChart></ResponsiveContainer></div></Panel><Panel title="Signal Inputs" subtitle={beginner ? "Plain-language mode explains why each indicator matters." : "Advanced score composition."}><Score label="Technical" value={asset.technical} /><Score label="Momentum" value={asset.momentum} /><Score label="Sentiment" value={asset.sentiment} /><Score label="Risk" value={asset.risk} /><Score label="Data quality" value={asset.dataQuality} /></Panel><Panel title="Prediction Estimate" subtitle="Stored predictions are never guaranteed financial advice."><div className="metric-grid"><Metric label="Horizon" value={`${prediction.horizonDays} days`} /><Metric label="Direction" value={prediction.direction} className={tone(prediction.direction)} /><Metric label="Low" value={formatPrice(prediction.predictedLow)} /><Metric label="High" value={formatPrice(prediction.predictedHigh)} /></div><p className="muted">{prediction.explanation}</p></Panel></div></section>; }

function PredictionsPage({ bundle }: { bundle: MarketBundle }) { if (!bundle.assets.length) return <EmptyMarket bundle={bundle} />; const predictions = bundle.assets.map((asset) => buildPrediction(asset)); return <section className="page"><h1>Prediction Dashboard</h1><p className="lead">Predictions are explainable estimates stored permanently by the Actions signal workflow.</p><div className="job-list">{predictions.map((prediction) => <article className="job-row" key={prediction.symbol}><div className="row-between"><strong>{prediction.symbol} {prediction.direction}</strong><span className={`badge ${tone(prediction.direction)}`}>{prediction.confidence}/100</span></div><span className="tiny">{prediction.explanation}</span></article>)}</div></section>; }

function WatchlistsPage({ bundle }: { bundle: MarketBundle }) { const [saved, setSaved] = useState<string[]>(() => JSON.parse(localStorage.getItem("stocks-v2:watchlist") || "[]")); const assets = bundle.assets.filter((asset) => saved.includes(asset.symbol)); return <section className="page"><h1>Watchlists</h1><p className="lead">Guests are saved locally. Signed-in users can persist watchlists to Supabase with RLS ownership.</p>{assets.length ? <AssetGrid assets={assets} /> : <Panel title="No watchlist rows" subtitle="Add an asset after provider ingestion loads the supported universe."><p className="muted">Saved symbols: {saved.join(", ") || "None"}</p><button className="danger-button" onClick={() => { setSaved([]); localStorage.removeItem("stocks-v2:watchlist"); }}>Clear</button></Panel>}</section>; }

function NewsPage({ bundle }: { bundle: MarketBundle }) { return <section className="page"><h1>News Impact Desk</h1><p className="lead">Provider headlines, summaries, sentiment, source, publication time, and relevance only.</p><NewsList bundle={bundle} /></section>; }

function LearnPage() { return <section className="page"><h1>Learn and Glossary</h1><p className="lead">Beginner definitions are safe to ship without market data because they do not claim current prices.</p><div className="definition-list">{glossary.map((term) => <article className="definition-row" key={term.term}><strong>{term.term}</strong><span className="muted">{term.shortDefinition}</span><span className="tiny">{term.category}</span></article>)}</div></section>; }

function AccountPage() { const configured = Boolean(supabase); return <section className="page"><h1>Account</h1><p className="lead">Supabase Auth supports email/password registration, verification, session persistence, password reset, and optional Google login when configured.</p><Panel title="Authentication Status" subtitle={configured ? "Supabase public config is present." : "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for auth."}><div className="toolbar"><input type="email" placeholder="Email" /><input type="password" placeholder="Password" /><button className="primary-button" disabled={!configured}>Sign In</button><button className="ghost-button" disabled={!configured}>Create Account</button></div></Panel></section>; }

function AdminPage({ bundle }: { bundle: MarketBundle }) { return <section className="page"><h1>Admin and System Health</h1><p className="lead">This page never displays secret values. Use GitHub Actions manual workflows for ingestion, backfill, indicators, predictions, and evaluation.</p><div className="grid"><Panel title="Provider Health" subtitle="Configured means the Actions workflow verified the provider and wrote status rows."><div className="table-wrap"><table><thead><tr><th>Service</th><th>Status</th><th>Last success</th><th>Latency</th></tr></thead><tbody>{bundle.health.map((row) => <tr key={row.service}><td>{row.service}</td><td><span className={`badge ${tone(row.status)}`}>{row.status}</span></td><td>{row.lastSuccess}</td><td>{row.latencyMs ?? "N/A"}</td></tr>)}</tbody></table></div></Panel><Panel title="Actions Jobs" subtitle="Use repository secrets, never frontend variables, for private API keys."><div className="job-list">{["ingest-market", "manual-backfill", "run-signals", "evaluate-predictions", "deploy-pages"].map((job) => <div className="job-row" key={job}><strong>{job}</strong><span className="tiny">Defined in .github/workflows.</span></div>)}</div></Panel></div></section>; }

function SettingsPage() { return <section className="page"><h1>Settings</h1><p className="lead">Theme, beginner mode, compact mode, default watchlist, and notifications are available through the top controls and Supabase settings table.</p></section>; }
function AssetGrid({ assets }: { assets: Asset[] }) { if (!assets.length) return <p className="muted">No provider rows match this section.</p>; return <div className="asset-grid">{assets.map((asset) => <article className="asset-card" key={asset.symbol} onClick={() => go("asset", asset.symbol)} tabIndex={0}><div className="asset-top"><div><div className="symbol">{asset.symbol}</div><span className="muted">{asset.name}</span></div><span className={`badge ${tone(asset.signal)}`}>{asset.signal}</span></div><div className="asset-bottom"><strong>{formatPrice(asset.price)}</strong><span className={tone(asset.changePct)}>{formatPct(asset.changePct)}</span></div><div className="tiny">{asset.type} - {asset.provider} - {asset.dataStatus}</div></article>)}</div>; }
function NewsList({ bundle }: { bundle: MarketBundle }) { if (!bundle.news.length) return <Panel title="No provider news loaded" subtitle="Run the ingestion workflow after configuring news provider secrets."><p className="muted">No fabricated headlines are displayed.</p></Panel>; return <div className="job-list">{bundle.news.map((item) => <article className="job-row" key={item.id}><div className="row-between"><strong>{item.headline}</strong><span className={`badge ${tone(item.sentiment)}`}>{item.sentiment}</span></div><span className="tiny">{item.source} - {new Date(item.publishedAt).toLocaleString()}</span><p className="muted">{item.summary}</p></article>)}</div>; }
function EmptyMarket({ bundle }: { bundle: MarketBundle }) { return <section className="page"><div className="empty-state panel"><Database size={34} /><h1>No market data loaded yet</h1><p className="lead">{bundle.message}</p><div className="definition-list"><div className="definition-row"><strong>1. Add GitHub Actions secrets</strong><span className="muted">Store provider keys and Supabase service-role key under repository Actions secrets.</span></div><div className="definition-row"><strong>2. Run migrations</strong><span className="muted">Create Supabase tables, RLS policies, public views, and glossary seed data.</span></div><div className="definition-row"><strong>3. Run ingestion</strong><span className="muted">The scheduled workflow fetches provider data, normalizes it, and writes Supabase rows.</span></div></div></div></section>; }
function EmptyChart() { return <div className="empty-chart"><LineChart size={42} /><strong>Chart waiting for provider rows</strong><span>No sample candles or random prices are rendered.</span></div>; }
function LoadingPage() { return <section className="page"><div className="panel"><Loader2 className="spin" size={24} /> Loading market configuration...</div></section>; }
function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) { return <section className="panel span-6"><div className="panel-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div>{children}</section>; }
function Metric({ label, value, className = "" }: { label: string; value: string; className?: string }) { return <div className="metric"><span>{label}</span><strong className={className}>{value}</strong></div>; }
function Score({ label, value }: { label: string; value: number }) { return <div className="score-row"><div className="row-between"><strong>{label}</strong><span>{value}/100</span></div><div className="score-line"><span style={{ width: `${value}%` }} /></div></div>; }
function saveWatch(symbol: string) { const saved = JSON.parse(localStorage.getItem("stocks-v2:watchlist") || "[]") as string[]; if (!saved.includes(symbol)) saved.push(symbol); localStorage.setItem("stocks-v2:watchlist", JSON.stringify(saved)); }
