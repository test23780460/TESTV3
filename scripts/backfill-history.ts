import { redact } from "./env";
import { createProvider } from "./providers";
import { adminClient, upsertAsset } from "./supabaseAdmin";

async function main() {
  const { env, supabase } = adminClient();
  const provider = createProvider(env);
  const symbols = (process.env.SYMBOLS ?? "AAPL,MSFT,NVDA,SPY,QQQ").split(",").map((s) => s.trim()).filter(Boolean);
  const end = new Date();
  const start = new Date();
  start.setFullYear(end.getFullYear() - 5);
  for (const symbol of symbols) {
    try {
      const bars = await provider.getHistoricalBars(symbol, "1d", start.toISOString(), end.toISOString());
      const assetId = await upsertAsset(supabase, { symbol, providerSymbol: symbol, name: symbol, assetType: symbol.endsWith("-USD") ? "Crypto" : "Stock", provider: provider.name });
      const rows = bars.map((bar) => ({ asset_id: assetId, interval: bar.interval, timestamp: bar.timestamp, open: bar.open, high: bar.high, low: bar.low, close: bar.close, adjusted_close: bar.adjustedClose, volume: bar.volume, provider: bar.provider, data_quality: bar.dataQuality }));
      if (rows.length) await supabase.from("price_bars").upsert(rows, { onConflict: "asset_id,interval,timestamp,provider" });
    } catch (error) { console.error(redact(error)); }
  }
}
main().catch((error) => { console.error(redact(error)); process.exit(1); });
