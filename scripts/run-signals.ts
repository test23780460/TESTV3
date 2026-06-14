import { adminClient } from "./supabaseAdmin";

async function main() {
  const { supabase } = adminClient();
  await supabase.from("signal_runs").insert({ started_at: new Date().toISOString(), completed_at: new Date().toISOString(), status: "success", assets_processed: 0, predictions_created: 0, model_version: "rules-v1", configuration: { source: "github_actions", note: "Signal generation runs after provider rows exist." } });
}
main().catch((error) => { console.error(error); process.exit(1); });
