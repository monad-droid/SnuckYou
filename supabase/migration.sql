-- YouSnuck Database Schema
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
  image_ingredients_url text,
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
  image_before_url text,
  image_after_url text,
  changed_at timestamptz,
  off_revision integer,
  detected_at timestamptz DEFAULT now()
);

-- AI verdict columns for ingredient change analysis
ALTER TABLE ingredient_changes ADD COLUMN IF NOT EXISTS ai_verdict_category text;
ALTER TABLE ingredient_changes ADD COLUMN IF NOT EXISTS ai_verdict_explanation text;
ALTER TABLE ingredient_changes ADD COLUMN IF NOT EXISTS ai_verdict_confidence integer;
ALTER TABLE ingredient_changes ADD COLUMN IF NOT EXISTS ai_analyzed_at timestamptz;

-- Policy for service role to update ingredient_changes (for AI verdicts)
CREATE POLICY "Allow service role update on ingredient_changes"
  ON ingredient_changes FOR UPDATE
  USING (true);

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

-- Waitlist for users who want to track specific products
CREATE TABLE IF NOT EXISTS waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  product_request text,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role insert on waitlist"
  ON waitlist FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow service role select on waitlist"
  ON waitlist FOR SELECT
  USING (true);

-- User watchlist for tracking purchased products
CREATE TABLE IF NOT EXISTS user_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  barcode text NOT NULL,
  product_name text,
  brand text,
  image_url text,
  receipt_name text,
  added_at timestamptz DEFAULT now(),
  UNIQUE(user_id, barcode)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON user_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_barcode ON user_watchlist(barcode);

ALTER TABLE user_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own watchlist"
  ON user_watchlist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watchlist"
  ON user_watchlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own watchlist"
  ON user_watchlist FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own watchlist"
  ON user_watchlist FOR DELETE
  USING (auth.uid() = user_id);
