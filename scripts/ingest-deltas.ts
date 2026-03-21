#!/usr/bin/env npx tsx
/**
 * Process ALL unprocessed delta files.
 * Streams large files line-by-line to avoid memory issues.
 *
 * Usage:
 *   npx tsx scripts/ingest-deltas.ts          (local)
 *   Also used by GitHub Actions on a daily schedule.
 */

import { createClient } from "@supabase/supabase-js";
import { createGunzip } from "zlib";
import { createInterface } from "readline";
import { Readable } from "stream";
import { isSignificantChange } from "../src/lib/diff";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local when running locally (GitHub Actions uses env vars directly)
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const BATCH_SIZE = 10;

type DeltaProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  ingredients_text?: string;
  ingredients?: unknown[];
  image_url?: string;
  categories_tags?: string[];
  last_modified_t?: number;
  rev?: number;
};

type Stats = {
  processed: number;
  changes: number;
  newProducts: number;
  errors: number;
};

async function processProduct(product: DeltaProduct, stats: Stats) {
  if (!product.code || !product.ingredients_text) return;
  stats.processed++;

  const { data: existing, error: selectError } = await supabase
    .from("products")
    .select("barcode, ingredients_text")
    .eq("barcode", product.code)
    .maybeSingle();

  if (selectError) {
    stats.errors++;
    return;
  }

  if (existing) {
    const oldIngredients = existing.ingredients_text || "";
    const newIngredients = product.ingredients_text;

    if (oldIngredients && newIngredients && isSignificantChange(oldIngredients, newIngredients)) {
      const { error } = await supabase.from("ingredient_changes").insert({
        barcode: product.code,
        product_name: product.product_name,
        brand: product.brands,
        ingredients_before: oldIngredients,
        ingredients_after: newIngredients,
        changed_at: product.last_modified_t
          ? new Date(product.last_modified_t * 1000).toISOString()
          : new Date().toISOString(),
        off_revision: product.rev,
      });
      if (!error) stats.changes++;
      else stats.errors++;
    }

    // Only update the ingredients text for future comparisons
    await supabase
      .from("products")
      .update({
        ingredients_text: product.ingredients_text,
        last_modified_t: product.last_modified_t,
        updated_at: new Date().toISOString(),
      })
      .eq("barcode", product.code);
  } else {
    // Store minimal record: just barcode + ingredients for future comparison
    const { error } = await supabase.from("products").insert({
      barcode: product.code,
      ingredients_text: product.ingredients_text,
      last_modified_t: product.last_modified_t,
    });
    if (!error) stats.newProducts++;
    else stats.errors++;
  }
}

async function processDeltaFile(filename: string): Promise<Stats> {
  const stats: Stats = { processed: 0, changes: 0, newProducts: 0, errors: 0 };
  const deltaUrl = `https://static.openfoodfacts.org/data/delta/${filename}`;

  // Check file size for logging
  try {
    const headRes = await fetch(deltaUrl, { method: "HEAD", headers: { "User-Agent": "SnuckYou/1.0" } });
    const contentLength = parseInt(headRes.headers.get("content-length") || "0", 10);
    const sizeMB = contentLength / (1024 * 1024);
    console.log(`  Downloading (${sizeMB.toFixed(1)}MB compressed)...`);
  } catch {
    console.log(`  Downloading...`);
  }

  const deltaRes = await fetch(deltaUrl, {
    headers: { "User-Agent": "SnuckYou/1.0" },
  });

  if (!deltaRes.ok || !deltaRes.body) {
    console.error(`  Failed to fetch ${filename}: ${deltaRes.status}`);
    return stats;
  }

  // Stream: fetch body → gunzip → readline (line-by-line, no memory blowup)
  const gunzip = createGunzip();
  const nodeStream = Readable.fromWeb(deltaRes.body as import("stream/web").ReadableStream);
  const decompressed = nodeStream.pipe(gunzip);
  const rl = createInterface({ input: decompressed, crlfDelay: Infinity });

  let batch: DeltaProduct[] = [];
  let totalLines = 0;

  for await (const line of rl) {
    totalLines++;
    try {
      const p: DeltaProduct = JSON.parse(line);
      if (!p.code || !p.ingredients_text) continue;
      batch.push(p);

      if (batch.length >= BATCH_SIZE) {
        await Promise.all(
          batch.map((product) => processProduct(product, stats).catch(() => { stats.errors++; }))
        );
        batch = [];
      }
    } catch {
      stats.errors++;
    }

    if (totalLines % 5000 === 0) {
      console.log(`    ${totalLines.toLocaleString()} lines | ${stats.processed} processed | ${stats.changes} changes | ${stats.newProducts} new`);
    }
  }

  // Flush remaining batch
  if (batch.length > 0) {
    await Promise.all(
      batch.map((product) => processProduct(product, stats).catch(() => { stats.errors++; }))
    );
  }

  // Record this delta as processed
  await supabase.from("processed_deltas").insert({
    filename,
    products_processed: stats.processed,
    changes_detected: stats.changes,
  });

  console.log(`  ${totalLines.toLocaleString()} total lines scanned`);
  return stats;
}

async function run() {
  console.log("[ingest] Fetching delta index...");

  const indexRes = await fetch("https://static.openfoodfacts.org/data/delta/index.txt", {
    headers: { "User-Agent": "SnuckYou/1.0" },
  });
  if (!indexRes.ok) {
    console.error("Failed to fetch delta index");
    process.exit(1);
  }

  const allFiles = (await indexRes.text()).trim().split("\n").filter(Boolean).map((f) => f.trim());

  const { data: processed } = await supabase.from("processed_deltas").select("filename");
  const processedSet = new Set((processed || []).map((r) => r.filename));

  const unprocessed = allFiles.filter((f) => !processedSet.has(f));

  console.log(`[ingest] ${allFiles.length} total deltas, ${processedSet.size} already processed, ${unprocessed.length} remaining\n`);

  if (unprocessed.length === 0) {
    console.log("All delta files already processed!");
    return;
  }

  const totals: Stats = { processed: 0, changes: 0, newProducts: 0, errors: 0 };
  const startTime = Date.now();

  for (let i = 0; i < unprocessed.length; i++) {
    const filename = unprocessed[i];
    console.log(`[${i + 1}/${unprocessed.length}] ${filename}`);

    try {
      const result = await processDeltaFile(filename);
      totals.processed += result.processed;
      totals.changes += result.changes;
      totals.newProducts += result.newProducts;
      totals.errors += result.errors;
      console.log(`  Done: ${result.processed} processed, ${result.changes} changes, ${result.newProducts} new, ${result.errors} errors\n`);
    } catch (err) {
      console.error(`  Error processing ${filename}:`, err instanceof Error ? err.message : err);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\n[ingest] Complete in ${elapsed}s`);
  console.log(`  Processed: ${totals.processed}`);
  console.log(`  Changes:   ${totals.changes}`);
  console.log(`  New:       ${totals.newProducts}`);
  console.log(`  Errors:    ${totals.errors}`);
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
