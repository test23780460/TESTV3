# Deployment Checklist

## Required GitHub Actions Secrets

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALPHA_VANTAGE_API_KEY`

## Optional GitHub Actions Secrets

- `FINNHUB_API_KEY`
- `COINGECKO_API_KEY`
- `CRON_SECRET`

## Required GitHub Repository Variables

- `MARKET_DATA_PROVIDER=alpha_vantage`
- `NEWS_DATA_PROVIDER=finnhub`

## Supabase

1. Create project.
2. Run `supabase/migrations/202606140001_market_platform.sql`.
3. Enable email/password auth.
4. Confirm RLS is enabled.
5. Confirm public views exist:
   - `assets_public_latest`
   - `provider_health_public`

## GitHub Pages

1. Push `main`.
2. Open `Settings -> Pages`.
3. Set source to `GitHub Actions`.
4. Run `Test, Build, and Deploy GitHub Pages`.
5. Visit `https://USERNAME.github.io/TESTV3/`.

## First Data Load

1. Add provider secrets.
2. Run `Provider Secret Readiness`.
3. Run `Scheduled Market Ingestion` manually.
4. Run `Manual Historical Backfill` for your selected symbols.
5. Run `Signal and Prediction Jobs`.
6. Refresh the GitHub Pages site.

## Verification

- No fake prices appear before provider rows exist.
- Provider health shows configured/missing status without revealing keys.
- Search returns rows only after ingestion.
- Predictions include educational disclaimer language.
- Watchlists persist locally for guests.
- Supabase RLS prevents cross-user private data access.
