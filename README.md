# YouSnuck

**We watch what they snuck in.**

A consumer transparency tool that catches companies quietly changing food and personal care product ingredients. YouSnuck monitors the [Open Food Facts](https://openfoodfacts.org) database daily for ingredient changes and surfaces them with clear before/after diffs.

## How It Works

```
Open Food Facts publishes daily delta exports
        ↓
GitHub Actions downloads & streams each delta file
        ↓
Compares ingredients against stored baselines in Supabase
        ↓
Significant changes are recorded with full before/after text
        ↓
Users search products and see change history with word-level diffs
```

## Features

- **Product Search** — Search by name or brand via the Open Food Facts API
- **Ingredient Change Detection** — Detects meaningful ingredient changes, filtering out trivial formatting differences
- **Visual Diffs** — Word-level before/after highlighting shows exactly what was added or removed
- **Change Feed** — Homepage shows the most recent ingredient changes across all tracked products
- **Time Since Change** — Shows how long it's been since a product's ingredients last changed
- **Daily Pipeline** — GitHub Actions processes Open Food Facts delta exports every day at 6 AM UTC
- **Product Photos** — Displays available product images from Open Food Facts

## Tech Stack

- **Next.js 14** (App Router) + React 18 + TypeScript
- **Tailwind CSS** with a custom dark theme
- **Supabase** (Postgres) for storing product baselines and change history
- **Open Food Facts API** for product search and display data
- **GitHub Actions** for scheduled daily ingestion

## Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a [Supabase](https://supabase.com) project
2. Run the migration in `supabase/migration.sql` via the SQL Editor
3. Copy `.env.local.example` to `.env.local` and fill in your keys:

```bash
cp .env.local.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (safe for browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only, used by ingestion) |
| `CRON_SECRET` | Secret token to secure the `/api/ingest` endpoint |

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Run the ingestion pipeline

The ingestion pipeline processes Open Food Facts delta exports to detect ingredient changes.

**Standalone script (recommended):**
```bash
npx tsx scripts/ingest-deltas.ts
```

**Via API endpoint:**
```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Automated (GitHub Actions):**
Runs daily at 6 AM UTC. Add `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to your repository's Actions secrets. Can also be triggered manually from the Actions tab.

## Database Schema

See `supabase/migration.sql` for the full schema.

| Table | Purpose |
|-------|---------|
| `products` | Current ingredient baselines for tracked products |
| `ingredient_changes` | Every detected ingredient change with before/after snapshots |
| `processed_deltas` | Tracks which delta files have been ingested |

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Home — search bar + recent changes feed
│   ├── search/page.tsx             # Search results with pagination
│   ├── product/[barcode]/page.tsx  # Product detail + change history
│   └── api/ingest/route.ts        # Ingestion API endpoint
├── components/
│   ├── Header.tsx                  # Navigation header
│   ├── SearchBar.tsx               # Search form
│   ├── ProductCard.tsx             # Product grid item with "CHANGED" badge
│   ├── ChangeFeed.tsx              # Recent changes list
│   └── DiffView.tsx                # Word-level ingredient diff display
└── lib/
    ├── supabase.ts                 # Supabase client + types
    ├── openfoodfacts.ts            # Open Food Facts API client
    └── diff.ts                     # Diff computation + significance detection

scripts/
├── ingest-deltas.ts    # Standalone delta processor (used by GitHub Actions)
├── ingest.ts           # API-based ingestion trigger
├── seed.ts             # Full database seed from OFF data dump
└── demo-changes.ts     # Generate test change data
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home — search bar + recent changes feed |
| `/search?q=...` | Search results grid with "CHANGED" badges |
| `/product/[barcode]` | Product detail with ingredient diff history |

## Data Source

All product data comes from [Open Food Facts](https://openfoodfacts.org), a free, open, collaborative database of food products from around the world. YouSnuck uses their [daily delta exports](https://static.openfoodfacts.org/data/delta/) to track changes over time.

## License

MIT
