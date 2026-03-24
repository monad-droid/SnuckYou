import { NextRequest, NextResponse } from "next/server";
import { getProduct, OFFProduct } from "@/lib/openfoodfacts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: NextRequest) {
  try {
    const { barcodes } = (await request.json()) as { barcodes: string[] };

    if (!barcodes || !Array.isArray(barcodes) || barcodes.length === 0) {
      return NextResponse.json({ error: "barcodes array required" }, { status: 400 });
    }

    // Cap at 20 per request
    const batch = barcodes.slice(0, 20);
    const results: { barcode: string; product: OFFProduct | null }[] = [];

    for (let i = 0; i < batch.length; i++) {
      if (i > 0) await sleep(200);
      const product = await getProduct(batch[i]);
      results.push({ barcode: batch[i], product });
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error("Lookup error:", err);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
