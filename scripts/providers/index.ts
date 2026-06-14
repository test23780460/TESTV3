import { ServerEnv } from "../env";
import { alphaVantageProvider } from "./alphaVantage";
import { coingeckoProvider } from "./coingecko";
import { finnhubProvider } from "./finnhub";
import type { MarketDataProvider } from "./types";

export function createProvider(env: ServerEnv): MarketDataProvider {
  if (env.MARKET_DATA_PROVIDER === "finnhub" && env.FINNHUB_API_KEY) return finnhubProvider(env.FINNHUB_API_KEY);
  if (env.MARKET_DATA_PROVIDER === "coingecko") return coingeckoProvider(env.COINGECKO_API_KEY);
  if (env.ALPHA_VANTAGE_API_KEY) return alphaVantageProvider(env.ALPHA_VANTAGE_API_KEY);
  throw new Error("No market provider key is configured in GitHub Actions secrets.");
}

export function createNewsProvider(env: ServerEnv): MarketDataProvider {
  if (env.NEWS_DATA_PROVIDER === "finnhub" && env.FINNHUB_API_KEY) return finnhubProvider(env.FINNHUB_API_KEY);
  if (env.ALPHA_VANTAGE_API_KEY) return alphaVantageProvider(env.ALPHA_VANTAGE_API_KEY);
  throw new Error("No news provider key is configured in GitHub Actions secrets.");
}
