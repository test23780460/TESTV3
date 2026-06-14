import { z } from "zod";

const publicEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  VITE_SUPABASE_ANON_KEY: z.string().optional().or(z.literal("")),
  VITE_APP_URL: z.string().optional().or(z.literal("")),
  VITE_GITHUB_PAGES_BASE_PATH: z.string().default("/TESTV3/")
});

export const publicEnv = publicEnvSchema.parse({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ?? "",
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
  VITE_APP_URL: import.meta.env.VITE_APP_URL ?? "",
  VITE_GITHUB_PAGES_BASE_PATH: import.meta.env.VITE_GITHUB_PAGES_BASE_PATH ?? "/TESTV3/"
});

export const isSupabaseConfigured = Boolean(publicEnv.VITE_SUPABASE_URL && publicEnv.VITE_SUPABASE_ANON_KEY);
