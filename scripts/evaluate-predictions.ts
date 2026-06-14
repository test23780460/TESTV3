import { adminClient } from "./supabaseAdmin";

async function main() {
  const { supabase } = adminClient();
  await supabase.from("api_usage_logs").insert({ provider: "system", endpoint: "evaluate-predictions", requested_at: new Date().toISOString(), success: true, cached: false, request_metadata: { note: "Evaluation job executed." } });
}
main().catch((error) => { console.error(error); process.exit(1); });
