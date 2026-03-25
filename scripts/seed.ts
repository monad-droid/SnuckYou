#!/usr/bin/env npx tsx
/**
 * Seed script — downloads the full Open Food Facts JSONL dump and
 * bulk-inserts every product that has ingredients_text into Supabase.
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * This streams the gzipped JSONL (~7GB) so memory stays manageable.
 * Expect it to take 60-120+ minutes depending on connection speed.
 */

import { createClient } from "@supabase/supabase-js";
import { createGunzip } from "zlib";
import { createInterface } from "readline";
import { Readable } from "stream";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const DUMP_URL =
  "https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz";

const BATCH_SIZE = 50; // rows per Supabase upsert (small to avoid statement timeouts)
const REPORT_EVERY = 5000; // log progress every N products
const DELAY_MS = 100; // ms between batches to avoid overwhelming the DB
const MAX_RETRIES = 3; // retries per failed batch

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

type ProductRow = {
  barcode: string;
  product_name: string | null;
  brand: string | null;
  ingredients_text: string;
  ingredients_json: unknown[] | null;
  image_url: string | null;
  categories: string | null;
  last_modified_t: number | null;
  rev: number | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function upsertWithRetry(batch: ProductRow[]): Promise<{ ok: boolean }> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const { error } = await supabase
      .from("products")
      .upsert(batch, { onConflict: "barcode", ignoreDuplicates: false });

    if (!error) return { ok: true };

    const msg = typeof error === "object" && "message" in error ? error.message : String(error);

    // If it's a statement timeout or temporary error, retry with backoff
    if (msg.includes("statement timeout") || msg.includes("temporarily unavailable") || msg.includes("fetch failed")) {
      const backoff = attempt * 2000; // 2s, 4s, 6s
      console.error(`[seed] Batch timeout (attempt ${attempt}/${MAX_RETRIES}), retrying in ${backoff / 1000}s...`);
      await sleep(backoff);
      continue;
    }

    // Non-retryable error
    console.error(`[seed] Batch upsert error: ${msg}`);
    return { ok: false };
  }

  console.error(`[seed] Batch failed after ${MAX_RETRIES} retries, skipping`);
  return { ok: false };
}

async function seed() {
  console.log(`[seed] Downloading full OFF dump from ${DUMP_URL}`);
  console.log(`[seed] This will take a while — streaming line by line...`);
  console.log(`[seed] Batch size: ${BATCH_SIZE}, delay: ${DELAY_MS}ms, retries: ${MAX_RETRIES}`);

  const res = await fetch(DUMP_URL, {
    headers: { "User-Agent": "YouSnuck/1.0 (seed script)" },
  });

  if (!res.ok || !res.body) {
    console.error(`[seed] Failed to fetch dump: ${res.status}`);
    process.exit(1);
  }

  // Pipe: fetch body → gunzip → readline (line-by-line)
  const gunzip = createGunzip();
  const nodeStream = Readable.fromWeb(res.body as import("stream/web").ReadableStream);
  const decompressed = nodeStream.pipe(gunzip);
  const rl = createInterface({ input: decompressed, crlfDelay: Infinity });

  // Handle stream errors gracefully instead of crashing
  let streamError = false;
  for (const stream of [nodeStream, gunzip, decompressed]) {
    stream.on("error", (err) => {
      console.error(`[seed] Stream error: ${err.message}`);
      streamError = true;
    });
  }

  let batch: ProductRow[] = [];
  let totalLines = 0;
  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  const startTime = Date.now();

  for await (const line of rl) {
    if (streamError) break;
    totalLines++;

    try {
      const p = JSON.parse(line);
      if (!p.code || !p.ingredients_text) {
        skipped++;
        continue;
      }

      batch.push({
        barcode: p.code,
        product_name: p.product_name || null,
        brand: p.brands || null,
        ingredients_text: p.ingredients_text,
        ingredients_json: p.ingredients || null,
        image_url: p.image_url || null,
        categories: p.categories_tags?.join(", ") || null,
        last_modified_t: p.last_modified_t || null,
        rev: p.rev || null,
      });

      if (batch.length >= BATCH_SIZE) {
        const result = await upsertWithRetry(batch);
        if (result.ok) {
          inserted += batch.length;
        } else {
          errors += batch.length;
        }
        batch = [];
        await sleep(DELAY_MS);
      }

      if (totalLines % REPORT_EVERY === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        console.log(
          `[seed] ${totalLines.toLocaleString()} lines scanned | ` +
            `${inserted.toLocaleString()} inserted | ` +
            `${skipped.toLocaleString()} skipped (no ingredients) | ` +
            `${errors} errors | ${elapsed}s elapsed`
        );
      }
    } catch {
      errors++;
    }
  }

  // Flush remaining batch
  if (batch.length > 0) {
    const result = await upsertWithRetry(batch);
    if (result.ok) {
      inserted += batch.length;
    } else {
      errors += batch.length;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\n[seed] Done!`);
  console.log(`  Total lines:  ${totalLines.toLocaleString()}`);
  console.log(`  Inserted:     ${inserted.toLocaleString()}`);
  console.log(`  Skipped:      ${skipped.toLocaleString()}`);
  console.log(`  Errors:       ${errors}`);
  console.log(`  Time:         ${elapsed}s`);

  if (streamError) {
    console.log(`\n[seed] Note: Stream was interrupted. Re-run to continue — existing rows will be upserted safely.`);
  }
}

seed().catch((err) => {
  console.error("[seed] Fatal:", err);
  process.exit(1);
});
