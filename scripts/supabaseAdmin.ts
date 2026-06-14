import { createClient } from "@supabase/supabase-js";
import { readServerEnv } from "./env";

export function adminClient() {
  const env = readServerEnv();
  return { env, supabase: createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) };
}

export async function upsertAsset(supabase: ReturnType<typeof adminClient>["supabase"], input: { symbol: string; providerSymbol: string; name: string; assetType: string; exchange?: string; currency?: string; sector?: string; provider: string; }) {
  const { data, error } = await supabase.from("assets").upsert({ symbol: input.symbol, provider_symbol: input.providerSymbol, name: input.name, asset_type: input.assetType, exchange: input.exchange, currency: input.currency ?? "USD", sector: input.sector, provider: input.provider, active: true }, { onConflict: "symbol,provider" }).select("id").single();
  if (error) throw error;
  return data.id as string;
}
