# Stocks V2 Market Signal Deck

Stocks V2 is a GitHub Pages-ready market research frontend backed by Supabase Postgres/Auth and GitHub Actions jobs for private market-provider access. The public site never bundles private provider keys. Until Supabase rows are loaded by the Actions ingestion workflow, the UI shows an unconfigured state and no fake prices.

Educational market research only. Nothing on this platform is financial advice. Market predictions are estimates and are not guarantees. Market data may be delayed, cached, estimated, or unavailable.

## Architecture

- Frontend: React, TypeScript, Vite, Recharts, GitHub Pages.
- Storage and Auth: Supabase Postgres, Supabase Auth, RLS.
- Private provider calls: GitHub Actions scripts using repository Actions secrets.
- Automations: scheduled GitHub Actions for five-minute ingestion, backfill, signal runs, prediction evaluation, and Pages deployment.
- Providers implemented: Alpha Vantage, Finnhub, CoinGecko.

## Local Installation

```bash
npm install
npm run secrets:check
npm run dev
npm run typecheck
npm run test
npm run build
```

The site will run without provider data, but it will not show fake market prices.

## GitHub Secrets

Add secrets here:

`GitHub Repository -> Settings -> Secrets and variables -> Actions -> New repository secret`

Use these names:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ALPHA_VANTAGE_API_KEY
FINNHUB_API_KEY
COINGECKO_API_KEY
CRON_SECRET
```

Do not paste provider keys into source files, GitHub Pages variables, Vite `VITE_*` variables, README examples, or browser JavaScript.

## GitHub Pages

The production URL format is:

```text
https://USERNAME.github.io/TESTV3/
```

This repo is configured with:

```text
VITE_GITHUB_PAGES_BASE_PATH=/TESTV3/
```

In GitHub:

1. Go to `Settings -> Pages`.
2. Set Source to `GitHub Actions`.
3. Push to `main`.
4. The `Test, Build, and Deploy GitHub Pages` workflow builds `dist` and deploys it.

The app uses hash routing, so supported views refresh safely on GitHub Pages.

## Provider Configuration

Default provider selection:

```text
MARKET_DATA_PROVIDER=alpha_vantage
NEWS_DATA_PROVIDER=finnhub
```

Change repository variables under:

`Settings -> Secrets and variables -> Actions -> Variables`

Provider calls are made from GitHub Actions scripts only. The frontend reads normalized rows from Supabase.

## Market Ingestion

Scheduled ingestion runs every five minutes:

```text
*/5 * * * *
```

Manual run:

1. Go to `Actions -> Scheduled Market Ingestion`.
2. Select `Run workflow`.
3. Optional: enter comma-separated symbols, for example `AAPL,MSFT,NVDA,SPY,QQQ,BTC-USD,ETH-USD`.

## Known Limitations

- I cannot add GitHub repository secrets from this connector because GitHub's repository-secret API is not exposed here.
- No provider keys are committed to this repository.
- Run `npm install` locally once Node/npm is available, then commit `package-lock.json` and switch workflows from `npm install` to `npm ci` if you want strict lockfile installs.
