import { adminClient, upsertAsset } from "./supabaseAdmin";
import { providerStatus, redact } from "./env";
import { createNewsProvider, createProvider } from "./providers";

const DEFAULT_SYMBOLS = [
  "SPY", "QQQ", "DIA", "IWM", "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL",
  "GOOG", "TSLA", "AVGO", "BRK.B", "LLY", "JPM", "V", "UNH", "XOM", "MA",
  "COST", "WMT", "HD", "PG", "NFLX", "JNJ", "BAC", "CRM", "ABBV", "ORCL",
  "KO", "CVX", "WFC", "MRK", "AMD", "CSCO", "ACN", "PEP", "LIN", "ADBE",
  "MCD", "TMO", "ABT", "DIS", "IBM", "GE", "QCOM", "CAT", "INTU", "VZ",
  "TXN", "NOW", "AMAT", "PM", "ISRG", "UBER", "GS", "RTX", "PFE", "BKNG",
  "SPGI", "LOW", "NEE", "HON", "AXP", "UNP", "T", "BLK", "ETN", "TJX",
  "SYK", "LMT", "VRTX", "C", "ELV", "COP", "PANW", "BA", "DE", "ADI"
];

async function main() {
  const { env, supabase } = adminClient();
  const provider = createProvider(env);
  const startedAt = new Date().toISOString();
  const requestedSymbols = process.env.SYMBOLS?.trim();
  const symbols = Array.from(new Set((requestedSymbols || DEFAULT_SYMBOLS.join(",")).split(",").map((symbol) => symbol.trim()).filter(Boolean)));
  const run = await supabase.from("data_ingestion_runs").insert({
    job_name: "ingest-market",
    provider: provider.name,
    started_at: startedAt,
    status: "running",
    requested_symbols: symbols
  }).select("id").single();
  if (run.error) throw run.error;

  const successful: string[] = [];
  const failed: string[] = [];
  let rowsInserted = 0;

  try {
    await supabase.from("provider_health").upsert(providerStatus(process.env).map((row) => ({
      provider: row.provider,
      status: row.configured ? "Configured" : "Missing key",
      checked_at: new Date().toISOString()
    })), { onConflict: "provider" });

    const quotes = await provider.getBatchQuotes(symbols);
    for (const quote of quotes) {
      try {
        const assetId = await upsertAsset(supabase, {
          symbol: quote.symbol,
          providerSymbol: quote.symbol,
          name: quote.symbol,
          assetType: quote.symbol.endsWith("-USD") ? "Crypto" : quote.symbol.startsWith("^") ? "Index" : "Stock",
          provider: quote.provider
        });
        await supabase.from("assets").update({ active: false }).eq("symbol", quote.symbol).neq("provider", quote.provider);
        const { error } = await supabase.from("market_quotes").insert({
          asset_id: assetId,
          price: quote.price,
          open: quote.open,
          high: quote.high,
          low: quote.low,
          previous_close: quote.previousClose,
          change: quote.change,
          change_percent: quote.changePercent,
          volume: quote.volume,
          market_cap: quote.marketCap,
          timestamp: quote.timestamp,
          provider: quote.provider,
          data_status: quote.dataStatus,
          raw_payload_reference: null
        });
        if (error) throw error;
        rowsInserted += 1;
        successful.push(quote.symbol);
      } catch (error) {
        failed.push(quote.symbol);
        console.error(redact(error));
      }
    }

    const newsProvider = createNewsProvider(env);
    const news = await newsProvider.getNews(successful.slice(0, 8));
    for (const item of news) {
      await supabase.from("news_articles").upsert({
        provider_article_id: item.providerArticleId,
        title: item.title,
        summary: item.summary,
        source: item.source,
        article_url: item.articleUrl,
        image_url: item.imageUrl,
        published_at: item.publishedAt,
        overall_sentiment: item.overallSentiment,
        relevance_score: item.relevanceScore
      }, { onConflict: "provider_article_id" });
    }

    await supabase.from("data_ingestion_runs").update({
      completed_at: new Date().toISOString(),
      status: failed.length ? "partial" : "success",
      successful_symbols: successful,
      failed_symbols: failed,
      rows_inserted: rowsInserted,
      metadata: { provider: provider.name, news_rows: news.length }
    }).eq("id", run.data.id);
  } catch (error) {
    await supabase.from("data_ingestion_runs").update({
      completed_at: new Date().toISOString(),
      status: "failed",
      successful_symbols: successful,
      failed_symbols: failed,
      rows_inserted: rowsInserted,
      error_message: redact(error)
    }).eq("id", run.data.id);
    throw error;
  }
}

main().catch((error) => {
  console.error(redact(error));
  process.exit(1);
});
