import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { analyzeIngredientChange } from "@/lib/ai-analysis";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Allow up to 300s for backfill processing
export const maxDuration = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Missing Supabase env vars" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Fetch changes that haven't been analyzed yet
  const { data: unanalyzed, error: fetchErr } = await supabase
    .from("ingredient_changes")
    .select("*")
    .is("ai_analyzed_at", null)
    .not("ingredients_before", "is", null)
    .not("ingredients_after", "is", null)
    .order("detected_at", { ascending: false })
    .limit(30);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!unanalyzed || unanalyzed.length === 0) {
    return NextResponse.json({ message: "No changes to backfill", analyzed: 0 });
  }

  let analyzed = 0;
  let failed = 0;

  for (let i = 0; i < unanalyzed.length; i++) {
    const change = unanalyzed[i];

    // Respect Groq rate limits (~30 req/min on free tier)
    if (i > 0) await sleep(2500);

    const verdict = await analyzeIngredientChange(
      change.ingredients_before,
      change.ingredients_after
    );

    if (verdict) {
      const { error: updateErr } = await supabase
        .from("ingredient_changes")
        .update({
          ai_verdict_category: verdict.category,
          ai_verdict_explanation: verdict.explanation,
          ai_verdict_confidence: verdict.confidence,
          ai_analyzed_at: new Date().toISOString(),
        })
        .eq("id", change.id);

      if (updateErr) {
        failed++;
      } else {
        analyzed++;
      }
    } else {
      failed++;
    }
  }

  // Count remaining
  const { count } = await supabase
    .from("ingredient_changes")
    .select("id", { count: "exact", head: true })
    .is("ai_analyzed_at", null);

  return NextResponse.json({
    analyzed,
    failed,
    remaining: count || 0,
  });
}
