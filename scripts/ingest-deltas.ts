#!/usr/bin/env npx tsx
/**
 * Process ALL unprocessed delta files locally (not via API route).
 * This avoids serverless timeouts and memory limits.
 *
 * Usage: npx tsx scripts/ingest-deltas.ts
 */

import { createClient } from "@supabase/supabase-js";
import { gunzipSync } from "zlib";
import { isSignificantChange } from "../src/lib/diff";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const BATCH_SIZE = 10;
const MAX_FILE_SIZE_MB = 50; // skip delta files larger than this

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

async function processProduct(
  product: DeltaProduct,
  stats: { processed: number; changes: number; newProducts: number; errors: number }
) {
  if (!product.code || !product.ingredients_text) return;
  stats.processed++;

  const { data: existing, error: selectError } = await supabase
    .from("products")
    .select("*")
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
        product_name: product.product_name || existing.product_name,
        brand: product.brands || existing.brand,
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

    await supabase
      .from("products")
      .update({
        product_name: product.product_name || existing.product_name,
        brand: product.brands || existing.brand,
        ingredients_text: product.ingredients_text,
        ingredients_json: product.ingredients || null,
        image_url: product.image_url || existing.image_url,
        categories: product.categories_tags?.join(", ") || existing.categories,
        last_modified_t: product.last_modified_t,
        rev: product.rev,
        updated_at: new Date().toISOString(),
      })
      .eq("barcode", product.code);
  } else {
    const { error } = await supabase.from("products").insert({
      barcode: product.code,
      product_name: product.product_name,
      brand: product.brands,
      ingredients_text: product.ingredients_text,
      ingredients_json: product.ingredients || null,
      image_url: product.image_url,
      categories: product.categories_tags?.join(", "),
      last_modified_t: product.last_modified_t,
      rev: product.rev,
    });
    if (!error) stats.newProducts++;
    else stats.errors++;
  }
}

async function processDeltaFile(filename: string) {
  const stats = { processed: 0, changes: 0, newProducts: 0, errors: 0 };
  const deltaUrl = `https://static.openfoodfacts.org/data/delta/${filename}`;

  // Check file size first with HEAD request
  try {
    const headRes = await fetch(deltaUrl, { method: "HEAD", headers: { "User-Agent": "SnuckYou/1.0" } });
    const contentLength = parseInt(headRes.headers.get("content-length") || "0", 10);
    const sizeMB = contentLength / (1024 * 1024);
    if (sizeMB > MAX_FILE_SIZE_MB) {
      console.log(`  Skipping ${filename} (${sizeMB.toFixed(1)}MB > ${MAX_FILE_SIZE_MB}MB limit)`);
      // Mark as processed so we don't retry it
      await supabase.from("processed_deltas").insert({
        filename,
        products_processed: 0,
        changes_detected: 0,
      });
      return null;
    }
    console.log(`  Downloading ${filename} (${sizeMB.toFixed(1)}MB)...`);
  } catch {
    // If HEAD fails, try downloading anyway
  }

  const deltaRes = await fetch(deltaUrl, {
    headers: { "User-Agent": "SnuckYou/1.0" },
  });

  if (!deltaRes.ok) {
    console.error(`  Failed to fetch ${filename}: ${deltaRes.status}`);
    return null;
  }

  const compressedBuffer = Buffer.from(await deltaRes.arrayBuffer());
  const decompressed = gunzipSync(compressedBuffer);
  const lines = decompressed.toString("utf-8").split("\n").filter(Boolean);

  const products: DeltaProduct[] = [];
  for (const line of lines) {
    try {
      const p: DeltaProduct = JSON.parse(line);
      if (p.code && p.ingredients_text) products.push(p);
    } catch {
      stats.errors++;
    }
  }

  console.log(`  ${lines.length} lines, ${products.length} with ingredients. Processing...`);

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((product) => processProduct(product, stats).catch(() => { stats.errors++; }))
    );
  }

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

  const totals = { processed: 0, changes: 0, newProducts: 0, errors: 0 };
  const startTime = Date.now();

  for (const filename of unprocessed) {
    console.log(`[${unprocessed.indexOf(filename) + 1}/${unprocessed.length}] ${filename}`);

    try {
      const result = await processDeltaFile(filename);
      if (result) {
        totals.processed += result.processed;
        totals.changes += result.changes;
        totals.newProducts += result.newProducts;
        totals.errors += result.errors;
        console.log(`  Done: ${result.processed} processed, ${result.changes} changes, ${result.newProducts} new, ${result.errors} errors\n`);
      }
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
