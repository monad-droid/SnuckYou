import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

const DEFAULT_PAGE_SIZE = 25;
const ALLOWED_PAGE_SIZES = [25, 50, 100];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const rawPageSize = parseInt(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10);
  const pageSize = ALLOWED_PAGE_SIZES.includes(rawPageSize) ? rawPageSize : DEFAULT_PAGE_SIZE;
  const search = searchParams.get("search")?.trim() || "";
  const verdict = searchParams.get("verdict") || "";
  const sort = searchParams.get("sort") || "newest";

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ changes: [], page, totalCount: 0, hasMore: false });
  }

  const offset = (page - 1) * pageSize;

  // Build the query
  let query = supabase
    .from("ingredient_changes")
    .select("*", { count: "exact" });

  // Search filter — match product name, brand, or barcode
  if (search) {
    query = query.or(
      `product_name.ilike.%${search}%,brand.ilike.%${search}%,barcode.ilike.%${search}%`
    );
  }

  // Verdict category filter
  if (verdict) {
    query = query.eq("ai_verdict_category", verdict);
  }

  // Sorting
  if (sort === "oldest") {
    query = query.order("detected_at", { ascending: true });
  } else if (sort === "risk") {
    // Sort health concerns first, then cost cutting, then others
    query = query
      .order("ai_verdict_category", { ascending: true, nullsFirst: false })
      .order("detected_at", { ascending: false });
  } else {
    query = query.order("detected_at", { ascending: false });
  }

  // Pagination
  query = query.range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const totalCount = count ?? 0;

  return NextResponse.json({
    changes: data || [],
    page,
    pageSize,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    hasMore: offset + pageSize < totalCount,
  });
}
