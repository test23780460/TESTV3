import type { HistoricalBar, MarketDataProvider, ProviderNews, ProviderQuote } from "./types";

const BASE_URL = "https://www.alphavantage.co/query";
function endpoint(params: Record<string, string>) { const url = new URL(BASE_URL); Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v)); return url; }
async function fetchJson(url: URL) { const response = await fetch(url); const json = await response.json(); if (!response.ok || json.Note || json["Error Message"] || json.Information) throw new Error(`Alpha Vantage request failed: ${json.Note || json["Error Message"] || json.Information || response.statusText}`); return json; }

export function alphaVantageProvider(apiKey: string): MarketDataProvider {
  return {
    name: "alpha_vantage",
    async getQuote(symbol: string): Promise<ProviderQuote> {
      const json = await fetchJson(endpoint({ function: "GLOBAL_QUOTE", symbol, apikey: apiKey }));
      const quote = json["Global Quote"];
      if (!quote?.["05. price"]) throw new Error(`Alpha Vantage quote missing for ${symbol}`);
      return { symbol, price: Number(quote["05. price"]), open: Number(quote["02. open"]), high: Number(quote["03. high"]), low: Number(quote["04. low"]), previousClose: Number(quote["08. previous close"]), change: Number(quote["09. change"]), changePercent: Number(String(quote["10. change percent"]).replace("%", "")), volume: Number(quote["06. volume"]) || null, timestamp: new Date().toISOString(), provider: "alpha_vantage", dataStatus: "Delayed", raw: quote };
    },
    async getHistoricalBars(symbol: string, interval: "1d" | "5m"): Promise<HistoricalBar[]> {
      const params = interval === "1d" ? { function: "TIME_SERIES_DAILY_ADJUSTED", outputsize: "full", symbol, apikey: apiKey } : { function: "TIME_SERIES_INTRADAY", interval: "5min", outputsize: "compact", symbol, apikey: apiKey };
      const json = await fetchJson(endpoint(params));
      const key = interval === "1d" ? "Time Series (Daily)" : "Time Series (5min)";
      return Object.entries(json[key] ?? {}).map(([timestamp, row]: [string, any]) => ({ symbol, interval, timestamp: new Date(timestamp).toISOString(), open: Number(row["1. open"]), high: Number(row["2. high"]), low: Number(row["3. low"]), close: Number(row["4. close"]), adjustedClose: Number(row["5. adjusted close"] ?? row["4. close"]), volume: Number(row["6. volume"] ?? row["5. volume"]) || null, provider: "alpha_vantage", dataQuality: "normal" })).filter((bar) => bar.close > 0 && bar.high >= bar.low);
    },
    async getBatchQuotes(symbols: string[]) { const settled = await Promise.allSettled(symbols.map((symbol) => this.getQuote(symbol))); return settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []); },
    async getNews(symbols: string[]): Promise<ProviderNews[]> {
      const json = await fetchJson(endpoint({ function: "NEWS_SENTIMENT", tickers: symbols.join(","), apikey: apiKey }));
      return (json.feed ?? []).map((item: any) => ({ providerArticleId: item.url, title: item.title, summary: item.summary, source: item.source, articleUrl: item.url, imageUrl: item.banner_image, publishedAt: item.time_published ? new Date(item.time_published.replace(/^(\d{4})(\d{2})(\d{2})T/, "$1-$2-$3T")).toISOString() : new Date().toISOString(), overallSentiment: item.overall_sentiment_label?.includes("Bullish") ? "Positive" : item.overall_sentiment_label?.includes("Bearish") ? "Negative" : "Neutral", relevanceScore: Number(item.relevance_score ?? 0), relatedSymbols: (item.ticker_sentiment ?? []).map((s: any) => s.ticker) }));
    }
  };
}
