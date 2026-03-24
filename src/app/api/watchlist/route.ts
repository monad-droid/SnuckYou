import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch watchlist items
  const { data: watchlist, error } = await supabase
    .from("user_watchlist")
    .select("*")
    .eq("user_id", user.id)
    .order("added_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get change counts for all watchlist barcodes
  const barcodes = (watchlist || []).map((w: { barcode: string }) => w.barcode);
  let changeCounts: Record<string, number> = {};

  if (barcodes.length > 0) {
    const { data: changes } = await supabase
      .from("ingredient_changes")
      .select("barcode")
      .in("barcode", barcodes);

    if (changes) {
      changeCounts = changes.reduce(
        (acc: Record<string, number>, c: { barcode: string }) => {
          acc[c.barcode] = (acc[c.barcode] || 0) + 1;
          return acc;
        },
        {}
      );
    }
  }

  return NextResponse.json({ watchlist: watchlist || [], changeCounts });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { items } = (await request.json()) as {
    items: {
      barcode: string;
      product_name: string | null;
      brand: string | null;
      image_url: string | null;
      receipt_name: string;
    }[];
  };

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "No items provided" }, { status: 400 });
  }

  const rows = items.map((item) => ({
    user_id: user.id,
    barcode: item.barcode,
    product_name: item.product_name,
    brand: item.brand,
    image_url: item.image_url,
    receipt_name: item.receipt_name,
  }));

  const { error } = await supabase
    .from("user_watchlist")
    .upsert(rows, { onConflict: "user_id,barcode" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ added: rows.length });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { barcode } = (await request.json()) as { barcode: string };

  if (!barcode) {
    return NextResponse.json({ error: "barcode required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_watchlist")
    .delete()
    .eq("user_id", user.id)
    .eq("barcode", barcode);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ removed: barcode });
}
