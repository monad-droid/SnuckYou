#!/usr/bin/env npx tsx
/**
 * Process ALL unprocessed delta files.
 * Streams large files line-by-line to avoid memory issues.
 * Retries failed downloads with exponential backoff.
 *
 * Usage:
 *   npx tsx scripts/ingest-deltas.ts          (local)
 *   Also used by GitHub Actions on a daily schedule.
 */

import { createClient } from "@supabase/supabase-js";
import { createGunzip } from "zlib";
import { createInterface } from "readline";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
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
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 5000; // 5s, 10s, 20s

type DeltaProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  ingredients_text?: string;
  ingredients?: unknown[];
  image_url?: string;
  image_ingredients_url?: string;
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
    .select("barcode, ingredients_text, image_ingredients_url")
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
        image_before_url: existing.image_ingredients_url || null,
        image_after_url: product.image_ingredients_url || null,
        changed_at: product.last_modified_t
          ? new Date(product.last_modified_t * 1000).toISOString()
          : new Date().toISOString(),
        off_revision: product.rev,
      });
      if (!error) stats.changes++;
      else stats.errors++;
    }

    // Only update the ingredients text + image for future comparisons
    await supabase
      .from("products")
      .update({
        ingredients_text: product.ingredients_text,
        image_ingredients_url: product.image_ingredients_url || existing.image_ingredients_url,
        last_modified_t: product.last_modified_t,
        updated_at: new Date().toISOString(),
      })
      .eq("barcode", product.code);
  } else {
    // Store minimal record: barcode + ingredients + image for future comparison
    const { error } = await supabase.from("products").insert({
      barcode: product.code,
      ingredients_text: product.ingredients_text,
      image_ingredients_url: product.image_ingredients_url,
      last_modified_t: product.last_modified_t,
    });
    if (!error) stats.newProducts++;
    else stats.errors++;
  }
}

async function streamDeltaFile(
  filename: string,
  stats: Stats,
): Promise<{ totalLines: number; completed: boolean }> {
  const deltaUrl = `https://static.openfoodfacts.org/data/delta/${filename}`;

  const deltaRes = await fetch(deltaUrl, {
    headers: { "User-Agent": "SnuckYou/1.0" },
  });

  if (!deltaRes.ok || !deltaRes.body) {
    throw new Error(`HTTP ${deltaRes.status}`);
  }

  const gunzip = createGunzip();
  const nodeStream = Readable.fromWeb(deltaRes.body as import("stream/web").ReadableStream);

  // Attach error handlers so stream errors don't crash the process
  nodeStream.on("error", () => { /* handled below via pipeline */ });
  gunzip.on("error", () => { /* handled below via pipeline */ });

  const rl = createInterface({ input: gunzip, crlfDelay: Infinity });

  let batch: DeltaProduct[] = [];
  let totalLines = 0;
  let streamError: Error | null = null;

  // Use pipeline for proper error propagation, but we still read line-by-line
  const pipelinePromise = pipeline(nodeStream, gunzip).catch((err) => {
    streamError = err;
  });

  try {
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
  } catch (err) {
    // readline iterator can throw on stream error — that's OK, we still processed lines up to this point
    streamError = err instanceof Error ? err : new Error(String(err));
  }

  // Flush remaining batch (process whatever we got before the error)
  if (batch.length > 0) {
    await Promise.all(
      batch.map((product) => processProduct(product, stats).catch(() => { stats.errors++; }))
    );
  }

  await pipelinePromise;

  console.log(`    ${totalLines.toLocaleString()} lines streamed so far`);

  if (streamError) {
    console.warn(`  Stream interrupted: ${streamError.message}`);
    return { totalLines, completed: false };
  }

  return { totalLines, completed: true };
}

async function processDeltaFile(filename: string): Promise<Stats> {
  const stats: Stats = { processed: 0, changes: 0, newProducts: 0, errors: 0 };
  const deltaUrl = `https://static.openfoodfacts.org/data/delta/${filename}`;

  // Check file size for logging
  try {
    const headRes = await fetch(deltaUrl, { method: "HEAD", headers: { "User-Agent": "SnuckYou/1.0" } });
    const contentLength = parseInt(headRes.headers.get("content-length") || "0", 10);
    const sizeMB = contentLength / (1024 * 1024);
    console.log(`  Size: ${sizeMB.toFixed(1)}MB compressed`);
  } catch {
    // ignore HEAD failure
  }

  let completed = false;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 1) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 2);
      console.log(`  Retry ${attempt}/${MAX_RETRIES} after ${delay / 1000}s...`);
      await new Promise((r) => setTimeout(r, delay));
    }

    console.log(`  Attempt ${attempt}: downloading & streaming...`);

    try {
      const result = await streamDeltaFile(filename, stats);
      if (result.completed) {
        completed = true;
        break;
      }
      // Stream was interrupted — retry will re-download but DB upserts are idempotent-ish
      // (inserts may conflict but that's fine, we just count the error)
      console.log(`  Attempt ${attempt} incomplete (${result.totalLines} lines before disconnect)`);
    } catch (err) {
      console.error(`  Attempt ${attempt} failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (!completed) {
    console.error(`  All ${MAX_RETRIES} attempts failed for ${filename} — skipping`);
    // Still record partial progress so we don't retry forever
    await supabase.from("processed_deltas").insert({
      filename,
      products_processed: stats.processed,
      changes_detected: stats.changes,
    });
    return stats;
  }

  // Record this delta as processed
  await supabase.from("processed_deltas").insert({
    filename,
    products_processed: stats.processed,
    changes_detected: stats.changes,
  });

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
