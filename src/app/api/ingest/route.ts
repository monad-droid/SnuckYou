import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSignificantChange } from "@/lib/diff";
import { gunzipSync } from "zlib";

// Allow up to 60s for this route (Vercel/Next.js)
export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const BATCH_SIZE = 10; // concurrent DB operations per batch
const MAX_PRODUCTS = 500; // cap per invocation to avoid timeouts

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

export async function POST(request: NextRequest) {
  // Verify cron secret
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
  const stats: { processed: number; changes: number; newProducts: number; errors: number; firstError?: string } =
    { processed: 0, changes: 0, newProducts: 0, errors: 0 };

  try {
    // 1. Get latest delta file URL from index
    const indexRes = await fetch(
      "https://static.openfoodfacts.org/data/delta/index.txt",
      { headers: { "User-Agent": "SnuckYou/1.0" }, signal: AbortSignal.timeout(10000) }
    );
    if (!indexRes.ok)
      return NextResponse.json(
        { error: "Failed to fetch delta index" },
        { status: 502 }
      );

    const indexText = await indexRes.text();
    const deltaFiles = indexText.trim().split("\n").filter(Boolean);
    if (deltaFiles.length === 0)
      return NextResponse.json(
        { error: "No delta files available" },
        { status: 404 }
      );

    // Process last delta file (most recent)
    const latestDelta = deltaFiles[deltaFiles.length - 1].trim();
    const deltaUrl = `https://static.openfoodfacts.org/data/delta/${latestDelta}`;

    // 2. Download and decompress (30s timeout for large files)
    const deltaRes = await fetch(deltaUrl, {
      headers: { "User-Agent": "SnuckYou/1.0" },
      signal: AbortSignal.timeout(30000),
    });
    if (!deltaRes.ok)
      return NextResponse.json(
        { error: `Failed to fetch delta: ${deltaUrl}` },
        { status: 502 }
      );

    const compressedBuffer = Buffer.from(await deltaRes.arrayBuffer());
    const decompressed = gunzipSync(compressedBuffer);
    const lines = decompressed.toString("utf-8").split("\n").filter(Boolean);

    // 3. Parse products (cap at MAX_PRODUCTS to avoid timeouts)
    const products: DeltaProduct[] = [];
    for (const line of lines) {
      if (products.length >= MAX_PRODUCTS) break;
      try {
        const p: DeltaProduct = JSON.parse(line);
        if (p.code && p.ingredients_text) products.push(p);
      } catch {
        stats.errors++;
      }
    }

    // 4. Process in concurrent batches
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

    return NextResponse.json({
      success: true,
      deltaFile: latestDelta,
      totalInDelta: lines.length,
      stats,
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
  return NextResponse.json({ status: "ok", service: "snuckyou-ingest" });
}
