#!/usr/bin/env npx tsx
/**
 * Inserts realistic demo ingredient changes so you can see
 * the change detection UI working end-to-end.
 *
 * Usage: npx tsx scripts/demo-changes.ts
 */

import { createClient } from "@supabase/supabase-js";
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

async function run() {
  // Grab 3 real products from your database that have ingredients
  const { data: products, error } = await supabase
    .from("products")
    .select("barcode, product_name, brand, ingredients_text")
    .not("ingredients_text", "is", null)
    .not("product_name", "is", null)
    .limit(3);

  if (error || !products || products.length === 0) {
    console.error("Could not fetch products:", error?.message || "No products found");
    process.exit(1);
  }

  console.log(`Found ${products.length} products to create demo changes for:\n`);

  // Simulate realistic ingredient changes for each product
  const modifications = [
    {
      // Swap an ingredient (e.g., butter → vegetable oil)
      transform: (text: string) =>
        text.replace(/butter/i, "vegetable oil").replace(/sugar/i, "high fructose corn syrup"),
      daysAgo: 3,
    },
    {
      // Add a new ingredient
      transform: (text: string) => text + ", artificial colors (Red 40, Yellow 5)",
      daysAgo: 7,
    },
    {
      // Remove an ingredient
      transform: (text: string) => {
        const parts = text.split(",").map((s) => s.trim());
        // Remove a middle ingredient
        if (parts.length > 4) parts.splice(2, 1);
        return parts.join(", ");
      },
      daysAgo: 1,
    },
  ];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const mod = modifications[i];
    const modifiedIngredients = mod.transform(product.ingredients_text);

    // Only insert if the ingredients actually changed
    if (modifiedIngredients === product.ingredients_text) {
      console.log(`  Skipping ${product.product_name} (no change from transform)`);
      continue;
    }

    const changedAt = new Date();
    changedAt.setDate(changedAt.getDate() - mod.daysAgo);

    const { error: insertErr } = await supabase.from("ingredient_changes").insert({
      barcode: product.barcode,
      product_name: product.product_name,
      brand: product.brand,
      ingredients_before: product.ingredients_text,
      ingredients_after: modifiedIngredients,
      changed_at: changedAt.toISOString(),
      off_revision: Math.floor(Math.random() * 50) + 10,
    });

    if (insertErr) {
      console.error(`  Error for ${product.product_name}: ${insertErr.message}`);
    } else {
      console.log(`  ✓ ${product.product_name} (${product.brand})`);
      console.log(`    Before: ${product.ingredients_text.slice(0, 80)}...`);
      console.log(`    After:  ${modifiedIngredients.slice(0, 80)}...`);
      console.log();
    }
  }

  console.log("Done! Refresh your app to see the changes on the homepage.");
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
