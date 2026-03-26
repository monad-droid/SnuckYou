import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = 24;

  if (!query) {
    return NextResponse.json({ products: [], count: 0, page, page_count: 0 });
  }

  // Build a tsquery from the search terms (prefix matching with :*)
  const terms = query.split(/\s+/).filter(Boolean);
  const tsquery = terms.map((t) => `${t}:*`).join(" & ");

  const offset = (page - 1) * pageSize;

  // Full-text search with ts_rank, falling back to trigram similarity
  const { data, error, count } = await supabase
    .from("products")
    .select("barcode, product_name, brand, image_url, categories", { count: "exact" })
    .textSearch("fts", tsquery)
    .range(offset, offset + pageSize - 1)
    .limit(pageSize);

  if (error) {
    // Fallback: ilike search if FTS column doesn't exist yet
    const likePattern = `%${query}%`;
    const { data: fallbackData, error: fallbackError, count: fallbackCount } = await supabase
      .from("products")
      .select("barcode, product_name, brand, image_url, categories", { count: "exact" })
      .or(`product_name.ilike.${likePattern},brand.ilike.${likePattern}`)
      .range(offset, offset + pageSize - 1)
      .limit(pageSize);

    if (fallbackError) {
      return NextResponse.json({ error: fallbackError.message }, { status: 500 });
    }

    return NextResponse.json({
      products: fallbackData || [],
      count: fallbackCount || 0,
      page,
      page_count: Math.ceil((fallbackCount || 0) / pageSize),
    });
  }

  return NextResponse.json({
    products: data || [],
    count: count || 0,
    page,
    page_count: Math.ceil((count || 0) / pageSize),
  });
}
