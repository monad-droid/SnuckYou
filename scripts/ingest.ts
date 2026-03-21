#!/usr/bin/env npx tsx
/**
 * Standalone ingestion script for running as a cron job.
 * Usage: CRON_SECRET=xxx npx tsx scripts/ingest.ts
 *
 * Alternatively, call the API endpoint directly:
 *   curl -X POST https://your-app.vercel.app/api/ingest \
 *     -H "Authorization: Bearer YOUR_CRON_SECRET"
 */

const API_URL = process.env.INGEST_API_URL || "http://localhost:3000/api/ingest";
const CRON_SECRET = process.env.CRON_SECRET || "";

async function run() {
  console.log(`[SnuckYou] Starting ingestion at ${new Date().toISOString()}`);
  console.log(`[SnuckYou] Calling ${API_URL}`);

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CRON_SECRET}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(`[SnuckYou] Ingestion failed:`, data);
    process.exit(1);
  }

  console.log(`[SnuckYou] Ingestion complete:`, JSON.stringify(data, null, 2));
}

run().catch((err) => {
  console.error(`[SnuckYou] Fatal error:`, err);
  process.exit(1);
});
