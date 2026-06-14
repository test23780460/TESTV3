create extension if not exists pgcrypto;

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  provider_symbol text not null,
  name text not null,
  asset_type text not null,
  exchange text,
  currency text default 'USD',
  sector text,
  active boolean default true,
  provider text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(symbol, provider)
);

create table if not exists public.market_quotes (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  price numeric not null check (price >= 0),
  open numeric,
  high numeric,
  low numeric,
  previous_close numeric,
  change numeric,
  change_percent numeric,
  volume numeric,
  market_cap numeric,
  timestamp timestamptz not null,
  provider text not null,
  data_status text not null default 'Delayed',
  raw_payload_reference text,
  created_at timestamptz default now(),
  constraint quote_high_low check (high is null or low is null or high >= low)
);

create table if not exists public.price_bars (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  interval text not null,
  timestamp timestamptz not null,
  open numeric not null check (open >= 0),
  high numeric not null check (high >= 0),
  low numeric not null check (low >= 0),
  close numeric not null check (close >= 0),
  adjusted_close numeric,
  volume numeric,
  provider text not null,
  data_quality text not null default 'normal',
  created_at timestamptz default now(),
  unique(asset_id, interval, timestamp, provider),
  constraint bar_high_low check (high >= low)
);

create table if not exists public.news_articles (
  id uuid primary key default gen_random_uuid(),
  provider_article_id text unique,
  title text not null,
  summary text,
  source text,
  article_url text not null,
  image_url text,
  published_at timestamptz,
  overall_sentiment text,
  sentiment_score numeric,
  relevance_score numeric,
  created_at timestamptz default now()
);

create table if not exists public.provider_health (
  provider text primary key,
  status text not null,
  last_success timestamptz,
  latency_ms int,
  checked_at timestamptz default now()
);

create table if not exists public.data_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  provider text,
  started_at timestamptz not null,
  completed_at timestamptz,
  status text not null,
  requested_symbols text[] default '{}',
  successful_symbols text[] default '{}',
  failed_symbols text[] default '{}',
  rows_inserted int default 0,
  api_requests int default 0,
  error_message text,
  metadata jsonb default '{}'
);

create table if not exists public.signal_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null,
  completed_at timestamptz,
  status text not null,
  assets_processed int default 0,
  predictions_created int default 0,
  model_version text,
  configuration jsonb default '{}',
  error_summary text,
  created_at timestamptz default now()
);

create table if not exists public.api_usage_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  endpoint text not null,
  requested_at timestamptz default now(),
  status_code int,
  response_time_ms int,
  success boolean,
  rate_limited boolean default false,
  cached boolean default false,
  error_type text,
  request_metadata jsonb default '{}'
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  preferred_theme text default 'system',
  beginner_mode boolean default true,
  compact_mode boolean default false,
  role text default 'user',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.watchlists(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  notes text,
  position int default 0,
  added_at timestamptz default now(),
  unique(watchlist_id, asset_id)
);

create table if not exists public.glossary_terms (
  id uuid primary key default gen_random_uuid(),
  term text unique not null,
  short_definition text not null,
  full_definition text,
  beginner_example text,
  category text
);

create index if not exists assets_symbol_idx on public.assets(symbol, name);
create index if not exists market_quotes_asset_timestamp_idx on public.market_quotes(asset_id, timestamp desc);
create index if not exists price_bars_chart_idx on public.price_bars(asset_id, interval, timestamp desc);
create index if not exists news_published_idx on public.news_articles(published_at desc);
create index if not exists ingestion_status_idx on public.data_ingestion_runs(status, started_at desc);

create or replace view public.assets_public_latest as
select distinct on (a.id)
  a.id as asset_id, a.symbol, a.provider_symbol, a.name, a.asset_type, a.exchange, a.sector,
  q.price, q.open, q.high, q.low, q.previous_close, q.change_percent, q.volume, q.market_cap,
  q.timestamp, q.provider, q.data_status,
  50 as rsi_14, 40 as volatility, 1 as relative_volume, q.price as support, q.price as resistance,
  50 as momentum, 50 as technical, 50 as sentiment, 80 as liquidity,
  case when q.data_status in ('Live','Delayed') then 80 else 55 end as data_quality_score,
  'Wait' as signal, 'Neutral' as direction, 50 as confidence, 50 as risk, array[q.price] as sparkline
from public.assets a join public.market_quotes q on q.asset_id = a.id
where a.active = true
order by a.id, q.timestamp desc;

create or replace view public.provider_health_public as select provider, status, last_success, latency_ms, checked_at from public.provider_health;

alter table public.profiles enable row level security;
alter table public.watchlists enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.assets enable row level security;
alter table public.market_quotes enable row level security;
alter table public.price_bars enable row level security;
alter table public.news_articles enable row level security;
alter table public.provider_health enable row level security;
alter table public.glossary_terms enable row level security;

create policy "profiles own read" on public.profiles for select using (auth.uid() = id);
create policy "profiles own update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "watchlists own access" on public.watchlists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "watchlist items own access" on public.watchlist_items for all using (exists(select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = auth.uid())) with check (exists(select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = auth.uid()));
create policy "assets public read" on public.assets for select using (true);
create policy "quotes public read" on public.market_quotes for select using (true);
create policy "bars public read" on public.price_bars for select using (true);
create policy "news public read" on public.news_articles for select using (true);
create policy "provider health public read" on public.provider_health for select using (true);
create policy "glossary public read" on public.glossary_terms for select using (true);

insert into public.glossary_terms(term, short_definition, category) values
('Volatility','How much an asset moves up and down over time.','Risk'),
('RSI','A momentum indicator that can flag overbought or oversold conditions.','Technical'),
('MACD','A trend and momentum indicator comparing fast and slow moving averages.','Technical'),
('Volume','How many shares, contracts, or units traded during a period.','Market activity'),
('Liquidity','How easily an asset can be bought or sold without moving the price too much.','Market structure'),
('Support','A price area where buyers have recently shown interest.','Technical'),
('Resistance','A price area where sellers have recently slowed advances.','Technical'),
('Sentiment','Whether news and discussion lean positive, neutral, or negative.','News')
on conflict (term) do update set short_definition = excluded.short_definition;
