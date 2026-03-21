import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSignificantChange } from "@/lib/diff";
import { gunzipSync } from "zlib";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const stats = { processed: 0, changes: 0, newProducts: 0, errors: 0 };

  try {
    // 1. Get latest delta file URL from index
    const indexRes = await fetch(
      "https://static.openfoodfacts.org/data/delta/index.txt",
      { headers: { "User-Agent": "SnuckYou/1.0" } }
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

    // 2. Download and decompress
    const deltaRes = await fetch(deltaUrl, {
      headers: { "User-Agent": "SnuckYou/1.0" },
    });
    if (!deltaRes.ok)
      return NextResponse.json(
        { error: `Failed to fetch delta: ${deltaUrl}` },
        { status: 502 }
      );

    const compressedBuffer = Buffer.from(await deltaRes.arrayBuffer());
    const decompressed = gunzipSync(compressedBuffer);
    const lines = decompressed.toString("utf-8").split("\n").filter(Boolean);

    // 3. Process each product record
    for (const line of lines) {
      try {
        const product: DeltaProduct = JSON.parse(line);
        if (!product.code || !product.ingredients_text) continue;

        stats.processed++;

        // Check for existing baseline
        const { data: existing } = await supabase
          .from("products")
          .select("*")
          .eq("barcode", product.code)
          .single();

        if (existing) {
          // Compare ingredients
          const oldIngredients = existing.ingredients_text || "";
          const newIngredients = product.ingredients_text;

          if (
            oldIngredients &&
            newIngredients &&
            isSignificantChange(oldIngredients, newIngredients)
          ) {
            // Record the change
            await supabase.from("ingredient_changes").insert({
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
            stats.changes++;
          }

          // Update baseline
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
          // New product — store baseline
          await supabase.from("products").insert({
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
          stats.newProducts++;
        }
      } catch {
        stats.errors++;
      }
    }

    return NextResponse.json({
      success: true,
      deltaFile: latestDelta,
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
