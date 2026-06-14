import type { Asset, NewsItem, ProviderHealth } from "../types";
import { supabase } from "./supabase";

const unconfiguredHealth: ProviderHealth[] = [
  { service: "Alpha Vantage", status: "Missing key", lastSuccess: "Not checked", latencyMs: null },
  { service: "Finnhub", status: "Missing key", lastSuccess: "Not checked", latencyMs: null },
  { service: "CoinGecko", status: "Missing key", lastSuccess: "Not checked", latencyMs: null },
  { service: "Supabase", status: "Provider unavailable", lastSuccess: "Public config missing or no rows available", latencyMs: null }
];

export interface MarketBundle {
  assets: Asset[];
  news: NewsItem[];
  health: ProviderHealth[];
  mode: "Unconfigured" | "Live" | "Cached";
  message: string;
}

export async function loadMarketBundle(): Promise<MarketBundle> {
  if (!supabase) {
    return {
      assets: [],
      news: [],
      health: unconfiguredHealth,
      mode: "Unconfigured",
      message: "Market provider keys are not configured yet. No sample prices are shown."
    };
  }

  try {
    const [assetRows, newsRows, healthRows] = await Promise.all([
      supabase.from("assets_public_latest").select("*").limit(80),
      supabase.from("news_articles").select("*").order("published_at", { ascending: false }).limit(24),
      supabase.from("provider_health_public").select("*")
    ]);
    if (assetRows.error) throw assetRows.error;
    const assets = (assetRows.data ?? []).map((row: any) => ({
      symbol: row.symbol,
      providerSymbol: row.provider_symbol ?? row.symbol,
      name: row.name,
      type: row.asset_type,
      exchange: row.exchange ?? "N/A",
      sector: row.sector ?? "Unknown",
      price: Number(row.price ?? 0),
      open: Number(row.open ?? 0),
      high: Number(row.high ?? 0),
      low: Number(row.low ?? 0),
      previousClose: Number(row.previous_close ?? 0),
      changePct: Number(row.change_percent ?? 0),
      volume: row.volume,
      relativeVolume: Number(row.relative_volume ?? 1),
      marketCap: row.market_cap,
      signal: row.signal ?? "Wait",
      direction: row.direction ?? "Neutral",
      confidence: Number(row.confidence ?? 50),
      risk: Number(row.risk ?? 50),
      rsi: Number(row.rsi_14 ?? 50),
      volatility: Number(row.volatility ?? 40),
      momentum: Number(row.momentum ?? 50),
      technical: Number(row.technical ?? 50),
      sentiment: Number(row.sentiment ?? 50),
      liquidity: Number(row.liquidity ?? 50),
      dataQuality: Number(row.data_quality_score ?? 60),
      support: Number(row.support ?? row.price ?? 0),
      resistance: Number(row.resistance ?? row.price ?? 0),
      history: row.sparkline ?? [Number(row.price ?? 0)],
      updatedAt: row.timestamp,
      dataStatus: row.data_status ?? "Cached",
      provider: row.provider ?? "Supabase",
      warning: row.data_status === "Live" ? "Live or delayed provider data. Verify independently before making decisions." : "Cached provider data. Verify freshness before using."
    })) as Asset[];

    if (!assets.length) throw new Error("No live assets returned from Supabase views.");
    return {
      assets,
      news: (newsRows.data ?? []).map((row: any) => ({
        id: row.id,
        headline: row.title,
        summary: row.summary ?? "",
        source: row.source ?? "Provider",
        category: "Markets",
        sentiment: row.overall_sentiment ?? "Neutral",
        sentimentScore: Number(row.sentiment_score ?? 0),
        impact: "Moderate",
        related: [],
        publishedAt: row.published_at,
        url: row.article_url
      })),
      health: (healthRows.data ?? unconfiguredHealth).map((row: any) => ({
        service: row.provider,
        status: row.status,
        lastSuccess: row.last_success ?? "Unavailable",
        latencyMs: row.latency_ms
      })),
      mode: "Live",
      message: "Loaded normalized provider data from Supabase. Private provider keys stay in GitHub Actions secrets."
    };
  } catch (error) {
    console.warn("Market data load failed; no fallback prices will be displayed.", error);
    return {
      assets: [],
      news: [],
      health: unconfiguredHealth,
      mode: "Unconfigured",
      message: "Live data could not be loaded. No fallback market prices are displayed."
    };
  }
}
