# SnuckYou

**We watch what they snuck in.**

A consumer transparency tool that shows when food and personal care product ingredients are quietly changed by manufacturers without announcement.

## Features

- **Product Search** — Search by product name or brand via Open Food Facts API
- **Ingredient History** — Full before/after diff of every detected ingredient change
- **Change Feed** — Recent ingredient changes across all tracked products
- **Monitoring Pipeline** — Daily delta ingestion from Open Food Facts

## Tech Stack

- **Frontend**: Next.js 14 + Tailwind CSS
- **Database**: Supabase (Postgres)
- **Data Source**: [Open Food Facts](https://world.openfoodfacts.org/)

## Setup

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

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Run the ingestion pipeline

The ingestion pipeline processes Open Food Facts delta exports to detect ingredient changes.

**Via API endpoint:**
```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Via standalone script:**
```bash
CRON_SECRET=xxx INGEST_API_URL=http://localhost:3000/api/ingest npx tsx scripts/ingest.ts
```

**As a daily cron job** (e.g., on Railway/Render):
Set the script to run daily with the appropriate environment variables.

## Database Schema

See `supabase/migration.sql` for the full schema.

- `products` — Current ingredient baselines for tracked products
- `ingredient_changes` — Every detected ingredient change with before/after snapshots

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home — search bar + recent changes feed |
| `/search?q=...` | Search results grid |
| `/product/[barcode]` | Product detail with ingredient diff history |
