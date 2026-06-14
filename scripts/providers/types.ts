export type ProviderDataStatus = "Live" | "Delayed" | "Cached" | "Temporarily unavailable" | "Market closed";

export interface ProviderAsset {
  symbol: string;
  providerSymbol: string;
  name: string;
  assetType: "Stock" | "ETF" | "Index" | "Crypto";
  exchange?: string;
  currency?: string;
  sector?: string;
  provider: string;
}

export interface ProviderQuote {
  symbol: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  change?: number;
  changePercent?: number;
  volume?: number | null;
  marketCap?: number | null;
  timestamp: string;
  provider: string;
  dataStatus: ProviderDataStatus;
  raw?: unknown;
}

export interface HistoricalBar {
  symbol: string;
  interval: "1d" | "5m";
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjustedClose?: number | null;
  volume?: number | null;
  provider: string;
  dataQuality: "verified" | "normal" | "incomplete" | "stale" | "suspicious" | "repaired";
}

export interface ProviderNews {
  providerArticleId: string;
  title: string;
  summary?: string;
  source?: string;
  articleUrl: string;
  imageUrl?: string;
  publishedAt: string;
  overallSentiment: "Positive" | "Neutral" | "Negative";
  relevanceScore?: number;
  relatedSymbols: string[];
}

export interface MarketDataProvider {
  name: string;
  searchAssets(query: string): Promise<ProviderAsset[]>;
  getQuote(symbol: string): Promise<ProviderQuote>;
  getHistoricalBars(symbol: string, interval: "1d" | "5m", startDate: string, endDate: string): Promise<HistoricalBar[]>;
  getBatchQuotes(symbols: string[]): Promise<ProviderQuote[]>;
  getNews(symbols: string[]): Promise<ProviderNews[]>;
}
