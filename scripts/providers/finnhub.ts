import type { HistoricalBar, MarketDataProvider, ProviderAsset, ProviderNews, ProviderQuote } from "./types";

const BASE_URL = "https://finnhub.io/api/v1";
const QUOTE_DELAY_MS = 250;

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function classifyNews(text: string): ProviderNews["overallSentiment"] {
  const lower = text.toLowerCase();
  const positive = /\b(beat|beats|raise|raises|raised|upgrade|upgraded|surge|surges|growth|record|strong|bullish|buy|outperform|profit|profits|rebound|wins|partnership)\b/.test(lower);
  const negative = /\b(miss|misses|cut|cuts|downgrade|downgraded|fall|falls|drop|drops|lawsuit|probe|warning|weak|bearish|sell|underperform|loss|risk|layoff|slump)\b/.test(lower);
  if (positive && !negative) return "Positive";
  if (negative && !positive) return "Negative";
  return "Neutral";
}

async function fetchJson(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set("token", token);
  const response = await fetch(url);
  const json = await response.json();
  if (!response.ok || json.error) throw new Error(`Finnhub request failed: ${json.error || response.statusText}`);
  return json;
}

export function finnhubProvider(token: string): MarketDataProvider {
  return {
    name: "finnhub",
    async searchAssets(query: string): Promise<ProviderAsset[]> {
      const json = await fetchJson("/search", token, { q: query });
      return (json.result ?? []).map((item: any) => ({
        symbol: item.symbol,
        providerSymbol: item.symbol,
        name: item.description,
        assetType: item.type?.includes("ETF") ? "ETF" : "Stock",
        provider: "finnhub"
      }));
    },
    async getQuote(symbol: string): Promise<ProviderQuote> {
      const quote = await fetchJson("/quote", token, { symbol });
      if (!quote.c) throw new Error(`Finnhub quote missing for ${symbol}`);
      return {
        symbol,
        price: Number(quote.c),
        open: Number(quote.o),
        high: Number(quote.h),
        low: Number(quote.l),
        previousClose: Number(quote.pc),
        change: Number(quote.d),
        changePercent: Number(quote.dp),
        volume: null,
        timestamp: quote.t ? new Date(Number(quote.t) * 1000).toISOString() : new Date().toISOString(),
        provider: "finnhub",
        dataStatus: "Delayed",
        raw: quote
      };
    },
    async getHistoricalBars(symbol: string, interval: "1d" | "5m", startDate: string, endDate: string): Promise<HistoricalBar[]> {
      const resolution = interval === "1d" ? "D" : "5";
      const from = Math.floor(new Date(startDate).getTime() / 1000).toString();
      const to = Math.floor(new Date(endDate).getTime() / 1000).toString();
      const candles = await fetchJson("/stock/candle", token, { symbol, resolution, from, to });
      if (candles.s !== "ok") return [];
      return candles.t.map((time: number, index: number) => ({
        symbol,
        interval,
        timestamp: new Date(time * 1000).toISOString(),
        open: Number(candles.o[index]),
        high: Number(candles.h[index]),
        low: Number(candles.l[index]),
        close: Number(candles.c[index]),
        adjustedClose: Number(candles.c[index]),
        volume: Number(candles.v[index]) || null,
        provider: "finnhub",
        dataQuality: "normal"
      }));
    },
    async getBatchQuotes(symbols: string[]) {
      const quotes: ProviderQuote[] = [];
      for (const symbol of symbols) {
        try {
          quotes.push(await this.getQuote(symbol));
        } catch (error) {
          console.error(`Finnhub quote failed for ${symbol}`, error);
        }
        await wait(QUOTE_DELAY_MS);
      }
      return quotes;
    },
    async getNews(symbols: string[]): Promise<ProviderNews[]> {
      const today = new Date();
      const weekAgo = new Date(Date.now() - 7 * 86400000);
      const settled = await Promise.allSettled(symbols.map((symbol) => fetchJson("/company-news", token, {
        symbol,
        from: weekAgo.toISOString().slice(0, 10),
        to: today.toISOString().slice(0, 10)
      })));
      return settled.flatMap((result, index) => result.status === "fulfilled" ? result.value.slice(0, 5).map((item: any) => {
        const text = `${item.headline ?? ""} ${item.summary ?? ""}`;
        return {
          providerArticleId: String(item.id ?? item.url),
          title: item.headline,
          summary: item.summary,
          source: item.source,
          articleUrl: item.url,
          imageUrl: item.image,
          publishedAt: item.datetime ? new Date(item.datetime * 1000).toISOString() : new Date().toISOString(),
          overallSentiment: classifyNews(text),
          relevanceScore: 0.62,
          relatedSymbols: [symbols[index]]
        };
      }) : []);
    }
  };
}
