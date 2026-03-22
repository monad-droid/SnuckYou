import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSignificantChange } from "@/lib/diff";
import { analyzeIngredientChange } from "@/lib/ai-analysis";
import { gunzipSync } from "zlib";

// Allow up to 300s for this route (processes multiple delta files)
export const maxDuration = 300;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const BATCH_SIZE = 10; // concurrent DB operations per batch
const MAX_DELTAS_PER_CALL = 5; // process at most 5 delta files per API call
const DOWNLOAD_TIMEOUT = 120000; // 2 min for large delta file downloads

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

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
  supabase: ReturnType<typeof getSupabaseAdmin>,
  product: DeltaProduct,
  stats: { processed: number; changes: number; newProducts: number; errors: number; firstError?: string }
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
    if (!stats.firstError) stats.firstError = `select: ${selectError.message}`;
    return;
  }

  if (existing) {
    const oldIngredients = existing.ingredients_text || "";
    const newIngredients = product.ingredients_text;

    if (
      oldIngredients &&
      newIngredients &&
      isSignificantChange(oldIngredients, newIngredients)
    ) {
      const { error: changeErr } = await supabase.from("ingredient_changes").insert({
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
      if (changeErr) {
        stats.errors++;
        if (!stats.firstError) stats.firstError = `insert change: ${changeErr.message}`;
      } else {
        stats.changes++;

        // Run AI analysis on the ingredient change
        const verdict = await analyzeIngredientChange(oldIngredients, newIngredients);
        if (verdict) {
          await supabase
            .from("ingredient_changes")
            .update({
              ai_verdict_category: verdict.category,
              ai_verdict_explanation: verdict.explanation,
              ai_verdict_confidence: verdict.confidence,
              ai_analyzed_at: new Date().toISOString(),
            })
            .eq("barcode", product.code)
            .eq("off_revision", product.rev);
        }
      }
    }

    const { error: updateErr } = await supabase
      .from("products")
      .update({
        product_name: product.product_name || existing.product_name,
        brand: product.brands || existing.brand,
        ingredients_text: product.ingredients_text,
        ingredients_json: product.ingredients || null,
        image_url: product.image_url || existing.image_url,
        categories:
          product.categories_tags?.join(", ") || existing.categories,
        last_modified_t: product.last_modified_t,
        rev: product.rev,
        updated_at: new Date().toISOString(),
      })
      .eq("barcode", product.code);
    if (updateErr) {
      stats.errors++;
      if (!stats.firstError) stats.firstError = `update: ${updateErr.message}`;
    }
  } else {
    const { error: insertErr } = await supabase.from("products").insert({
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
    if (insertErr) {
      stats.errors++;
      if (!stats.firstError) stats.firstError = `insert: ${insertErr.message}`;
    } else {
      stats.newProducts++;
    }
  }
}

async function processDeltaFile(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  filename: string
): Promise<{ processed: number; changes: number; newProducts: number; errors: number; firstError?: string }> {
  const stats: { processed: number; changes: number; newProducts: number; errors: number; firstError?: string } =
    { processed: 0, changes: 0, newProducts: 0, errors: 0 };

  const deltaUrl = `https://static.openfoodfacts.org/data/delta/${filename}`;
  const deltaRes = await fetch(deltaUrl, {
    headers: { "User-Agent": "YouSnuck/1.0" },
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT),
  });

  if (!deltaRes.ok) {
    return { ...stats, errors: 1, firstError: `Failed to fetch ${filename}: ${deltaRes.status}` };
  }

  const compressedBuffer = Buffer.from(await deltaRes.arrayBuffer());
  const decompressed = gunzipSync(compressedBuffer);
  const lines = decompressed.toString("utf-8").split("\n").filter(Boolean);

  // Parse all products with ingredients
  const products: DeltaProduct[] = [];
  for (const line of lines) {
    try {
      const p: DeltaProduct = JSON.parse(line);
      if (p.code && p.ingredients_text) products.push(p);
    } catch {
      stats.errors++;
    }
  }

  // Process in concurrent batches
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((product) =>
        processProduct(supabase, product, stats).catch(() => {
          stats.errors++;
        })
      )
    );
  }

  // Record this delta as processed
  await supabase.from("processed_deltas").insert({
    filename,
    products_processed: stats.processed,
    changes_detected: stats.changes,
  });

  return stats;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 500 }
    );
  }

  const supabase = getSupabaseAdmin();

  try {
    // 1. Get all available delta files
    const indexRes = await fetch(
      "https://static.openfoodfacts.org/data/delta/index.txt",
      { headers: { "User-Agent": "YouSnuck/1.0" }, signal: AbortSignal.timeout(10000) }
    );
    if (!indexRes.ok)
      return NextResponse.json({ error: "Failed to fetch delta index" }, { status: 502 });

    const indexText = await indexRes.text();
    const allDeltaFiles = indexText.trim().split("\n").filter(Boolean).map((f) => f.trim());

    if (allDeltaFiles.length === 0)
      return NextResponse.json({ error: "No delta files available" }, { status: 404 });

    // 2. Get already-processed delta filenames
    const { data: processed } = await supabase
      .from("processed_deltas")
      .select("filename");

    const processedSet = new Set((processed || []).map((r) => r.filename));

    // 3. Find unprocessed deltas (limit per call to avoid timeouts)
    const allUnprocessed = allDeltaFiles.filter((f) => !processedSet.has(f));

    if (allUnprocessed.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All delta files already processed",
        totalAvailable: allDeltaFiles.length,
        alreadyProcessed: processedSet.size,
      });
    }

    const unprocessed = allUnprocessed.slice(0, MAX_DELTAS_PER_CALL);

    // 4. Process each unprocessed delta file
    const totals = { processed: 0, changes: 0, newProducts: 0, errors: 0, firstError: undefined as string | undefined };
    const deltaResults: { filename: string; processed: number; changes: number; newProducts: number }[] = [];

    for (const filename of unprocessed) {
      console.log(`[ingest] Processing delta: ${filename}`);
      const result = await processDeltaFile(supabase, filename);

      totals.processed += result.processed;
      totals.changes += result.changes;
      totals.newProducts += result.newProducts;
      totals.errors += result.errors;
      if (result.firstError && !totals.firstError) totals.firstError = result.firstError;

      deltaResults.push({
        filename,
        processed: result.processed,
        changes: result.changes,
        newProducts: result.newProducts,
      });
    }

    return NextResponse.json({
      success: true,
      deltasProcessed: unprocessed.length,
      deltasRemaining: allUnprocessed.length - unprocessed.length,
      deltasSkipped: processedSet.size,
      totalAvailable: allDeltaFiles.length,
      stats: totals,
      deltas: deltaResults,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Ingestion failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET endpoint for health check
export async function GET() {
  return NextResponse.json({ status: "ok", service: "yousnuck-ingest" });
}
