-- SnuckYou Database Schema
-- Run this in Supabase SQL Editor to set up the database

-- Current product baselines
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode text UNIQUE NOT NULL,
  product_name text,
  brand text,
  ingredients_text text,
  ingredients_json jsonb,
  image_url text,
  categories text,
  last_modified_t bigint,
  rev integer,
  first_seen_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Every detected ingredient change
CREATE TABLE IF NOT EXISTS ingredient_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode text NOT NULL,
  product_name text,
  brand text,
  ingredients_before text,
  ingredients_after text,
  changed_at timestamptz,
  off_revision integer,
  detected_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_changes_barcode ON ingredient_changes(barcode);
CREATE INDEX IF NOT EXISTS idx_changes_detected_at ON ingredient_changes(detected_at DESC);

-- Enable Row Level Security (allow public reads)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_changes ENABLE ROW LEVEL SECURITY;

-- Public read access policies
CREATE POLICY "Allow public read access on products"
  ON products FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access on ingredient_changes"
  ON ingredient_changes FOR SELECT
  USING (true);

-- Service role insert/update (for the ingestion pipeline)
CREATE POLICY "Allow service role insert on products"
  ON products FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow service role update on products"
  ON products FOR UPDATE
  USING (true);

CREATE POLICY "Allow service role insert on ingredient_changes"
  ON ingredient_changes FOR INSERT
  WITH CHECK (true);

-- Track which delta files have been processed
CREATE TABLE IF NOT EXISTS processed_deltas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text UNIQUE NOT NULL,
  products_processed integer DEFAULT 0,
  changes_detected integer DEFAULT 0,
  processed_at timestamptz DEFAULT now()
);

ALTER TABLE processed_deltas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on processed_deltas"
  ON processed_deltas FOR SELECT
  USING (true);

CREATE POLICY "Allow service role insert on processed_deltas"
  ON processed_deltas FOR INSERT
  WITH CHECK (true);
