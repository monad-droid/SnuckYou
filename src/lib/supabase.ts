import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
}

// Legacy export for convenience — returns null if not configured
export const supabase = (() => {
  // Defer creation to avoid build-time errors when env vars aren't set
  return new Proxy({} as SupabaseClient, {
    get(_target, prop) {
      const client = getSupabase();
      if (!client) {
        // Return a no-op that returns empty data
        if (prop === "from") {
          return () => ({
            select: () => ({
              order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
              eq: () => ({
                order: () => Promise.resolve({ data: [], error: null }),
                single: () => Promise.resolve({ data: null, error: null }),
              }),
              in: () => Promise.resolve({ data: [], error: null }),
              single: () => Promise.resolve({ data: null, error: null }),
            }),
            insert: () => Promise.resolve({ data: null, error: null }),
            update: () => ({
              eq: () => Promise.resolve({ data: null, error: null }),
            }),
          });
        }
        return undefined;
      }
      return (client as unknown as Record<string | symbol, unknown>)[prop];
    },
  });
})();

export type Product = {
  id: string;
  barcode: string;
  product_name: string | null;
  brand: string | null;
  ingredients_text: string | null;
  ingredients_json: unknown;
  image_url: string | null;
  categories: string | null;
  last_modified_t: number | null;
  rev: number | null;
  first_seen_at: string;
  updated_at: string;
};

export type IngredientChange = {
  id: string;
  barcode: string;
  product_name: string | null;
  brand: string | null;
  ingredients_before: string | null;
  ingredients_after: string | null;
  changed_at: string | null;
  off_revision: number | null;
  detected_at: string;
};
