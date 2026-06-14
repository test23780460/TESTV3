export type AssetType = "Stock" | "ETF" | "Index" | "Crypto";
export type DataStatus = "Live" | "Delayed" | "Cached" | "Temporarily unavailable" | "Market closed";
export type Direction = "Bullish" | "Bearish" | "Neutral";
export type Signal = "Watch" | "Wait" | "Avoid";

export interface Asset {
  symbol: string;
  providerSymbol: string;
  name: string;
  type: AssetType;
  exchange: string;
  sector: string;
  price: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  changePct: number;
  volume: number | null;
  relativeVolume: number;
  marketCap?: number;
  signal: Signal;
  direction: Direction;
  confidence: number;
  risk: number;
  rsi: number;
  volatility: number;
  momentum: number;
  technical: number;
  sentiment: number;
  liquidity: number;
  dataQuality: number;
  support: number;
  resistance: number;
  warning: string;
  history: number[];
  updatedAt: string;
  dataStatus: DataStatus;
  provider: string;
}

export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  category: string;
  sentiment: "Positive" | "Neutral" | "Negative";
  sentimentScore: number;
  impact: "Low" | "Moderate" | "High";
  related: string[];
  publishedAt: string;
  url?: string;
}

export interface ProviderHealth {
  service: string;
  status: "Configured" | "Missing key" | "Invalid key" | "Rate limited" | "Provider unavailable";
  lastSuccess: string;
  latencyMs: number | null;
}

export interface Prediction {
  symbol: string;
  horizonDays: 7 | 14 | 30;
  direction: Direction;
  confidence: number;
  startingPrice: number;
  predictedLow: number;
  predictedHigh: number;
  predictedPrice: number;
  signalScore: number;
  explanation: string;
  status: "active" | "correct" | "incorrect" | "partial" | "expired";
  modelVersion: string;
  generatedAt: string;
}
