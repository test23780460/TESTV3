import type { HistoricalBar, MarketDataProvider, ProviderNews, ProviderQuote } from "./types";

export function finnhubProvider(token: string): MarketDataProvider {
  async function fetchJson(path: string, params: Record<string, string> = {}) {
    const url = new URL(`https://finnhub.io/api/v1${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    url.searchParams.set("token", token);
    const response = await fetch(url);
    const json = await response.json();
    if (!response.ok || json.error) throw new Error(`Finnhub request failed: ${json.error || response.statusText}`);
    return json;
  }
  return {
    name: "finnhub",
    async getQuote(symbol: string): Promise<ProviderQuote> { const q = await fetchJson("/quote", { symbol }); return { symbol, price: Number(q.c), open: Number(q.o), high: Number(q.h), low: Number(q.l), previousClose: Number(q.pc), change: Number(q.d), changePercent: Number(q.dp), volume: null, timestamp: q.t ? new Date(Number(q.t) * 1000).toISOString() : new Date().toISOString(), provider: "finnhub", dataStatus: "Delayed", raw: q }; },
    async getHistoricalBars(symbol: string, interval: "1d" | "5m", startDate: string, endDate: string): Promise<HistoricalBar[]> { const resolution = interval === "1d" ? "D" : "5"; const candles = await fetchJson("/stock/candle", { symbol, resolution, from: String(Math.floor(new Date(startDate).getTime() / 1000)), to: String(Math.floor(new Date(endDate).getTime() / 1000)) }); if (candles.s !== "ok") return []; return candles.t.map((time: number, i: number) => ({ symbol, interval, timestamp: new Date(time * 1000).toISOString(), open: Number(candles.o[i]), high: Number(candles.h[i]), low: Number(candles.l[i]), close: Number(candles.c[i]), adjustedClose: Number(candles.c[i]), volume: Number(candles.v[i]) || null, provider: "finnhub", dataQuality: "normal" })); },
    async getBatchQuotes(symbols: string[]) { const settled = await Promise.allSettled(symbols.map((symbol) => this.getQuote(symbol))); return settled.flatMap((r) => r.status === "fulfilled" ? [r.value] : []); },
    async getNews(): Promise<ProviderNews[]> { return []; }
  };
}
