import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_ANON_KEY: z.string().optional(),
  ALPHA_VANTAGE_API_KEY: z.string().optional(),
  FINNHUB_API_KEY: z.string().optional(),
  COINGECKO_API_KEY: z.string().optional(),
  MARKET_DATA_PROVIDER: z.enum(["alpha_vantage", "finnhub", "coingecko"]).default("finnhub"),
  NEWS_DATA_PROVIDER: z.enum(["finnhub", "alpha_vantage"]).default("finnhub"),
  CRON_SECRET: z.string().optional()
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function readServerEnv() {
  return serverEnvSchema.parse(process.env);
}

export function providerStatus(env = process.env) {
  return [
    { provider: "alpha_vantage", configured: Boolean(env.ALPHA_VANTAGE_API_KEY) },
    { provider: "finnhub", configured: Boolean(env.FINNHUB_API_KEY) },
    { provider: "coingecko", configured: Boolean(env.COINGECKO_API_KEY) }
  ];
}

export function redact(value: unknown) {
  const text = String(value ?? "");
  return text.replace(/[A-Za-z0-9_-]{16,}/g, "[redacted]");
}
