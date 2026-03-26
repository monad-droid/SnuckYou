import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  const client = new Client({ connectionString: databaseUrl });
  const batchSize = 5000;
  let totalUpdated = 0;
  const log: string[] = [];

  try {
    await client.connect();
    // No statement timeout — we manage our own time
    await client.query("SET statement_timeout = 0");

    // Step 1: Ensure fts column exists
    const colCheck = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'fts'"
    );
    if (colCheck.rows.length === 0) {
      await client.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS fts tsvector");
      log.push("Created fts column");
    } else {
      log.push("fts column already exists");
    }

    // Step 2: Ensure GIN index exists
    await client.query("CREATE INDEX IF NOT EXISTS idx_products_fts ON products USING gin(fts)");
    log.push("FTS index ready");

    // Step 3: Ensure trigram extension + indexes
    await client.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
    await client.query("CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin(product_name gin_trgm_ops)");
    await client.query("CREATE INDEX IF NOT EXISTS idx_products_brand_trgm ON products USING gin(brand gin_trgm_ops)");
    log.push("Trigram indexes ready");

    // Step 4: Backfill fts in batches
    const countRes = await client.query("SELECT COUNT(*) FROM products WHERE fts IS NULL");
    const remaining = parseInt(countRes.rows[0].count, 10);
    log.push(`${remaining} rows need fts backfill`);

    let updated = 1;
    while (updated > 0) {
      const res = await client.query(`
        UPDATE products SET fts =
          setweight(to_tsvector('english', coalesce(product_name, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(brand, '')), 'B')
        WHERE id IN (SELECT id FROM products WHERE fts IS NULL LIMIT $1)
      `, [batchSize]);
      updated = res.rowCount || 0;
      totalUpdated += updated;
    }

    log.push(`Backfilled ${totalUpdated} rows`);

    // Step 5: Also apply the missing UPDATE RLS policy for user_watchlist
    try {
      await client.query(`
        CREATE POLICY "Users can update own watchlist"
          ON user_watchlist FOR UPDATE
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id)
      `);
      log.push("Created watchlist UPDATE policy");
    } catch {
      log.push("Watchlist UPDATE policy already exists");
    }

    return NextResponse.json({ success: true, totalUpdated, log });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message, log, totalUpdated }, { status: 500 });
  } finally {
    await client.end();
  }
}
