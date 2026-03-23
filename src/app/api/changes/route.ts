import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  const { data, error } = await supabase
    .from("ingredient_changes")
    .select("*")
    .order("detected_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    changes: data || [],
    page,
    hasMore: (data || []).length === PAGE_SIZE,
  });
}
