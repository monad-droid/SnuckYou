import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/my-products";

  if (code) {
    try {
      const supabase = await createServerSupabaseClient();
      // Race the code exchange against a 8s timeout
      const timeout = new Promise<{ error: { message: string } }>((resolve) =>
        setTimeout(() => resolve({ error: { message: "Code exchange timed out" } }), 8000)
      );
      const { error } = await Promise.race([
        supabase.auth.exchangeCodeForSession(code),
        timeout,
      ]);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      console.error("Auth callback error:", error.message);
    } catch (e) {
      console.error("Auth callback exception:", e);
    }
  }

  // Auth failed — redirect to home
  return NextResponse.redirect(`${origin}/?auth_error=true`);
}
