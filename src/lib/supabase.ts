import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, publicEnv } from "./config";

export const supabase = isSupabaseConfigured
  ? createClient(publicEnv.VITE_SUPABASE_URL!, publicEnv.VITE_SUPABASE_ANON_KEY!, {
      auth: { persistSession: true, autoRefreshToken: true }
    })
  : null;
