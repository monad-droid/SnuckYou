import SearchBar from "@/components/SearchBar";
import ChangeFeed from "@/components/ChangeFeed";
import { supabase, IngredientChange } from "@/lib/supabase";

async function getRecentChanges(): Promise<IngredientChange[]> {
  try {
    const { data, error } = await supabase
      .from("ingredient_changes")
      .select("*")
      .order("detected_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    return (data as IngredientChange[]) || [];
  } catch {
    // Supabase may not be configured yet — return empty
    return [];
  }
}

export const revalidate = 60;

export default async function Home() {
  const recentChanges = await getRecentChanges();

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="text-center pt-12 pb-6">
        <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-3">
          Snuck<span className="text-accent">You</span>
        </h1>
        <p className="text-muted text-lg mb-8">
          We watch what they snuck in.
        </p>
        <div className="flex justify-center">
          <SearchBar large />
        </div>
        <p className="text-xs text-muted mt-4">
          Search by product name, brand, or UPC — powered by Open Food Facts
        </p>
      </section>

      {/* Recent Changes Feed */}
      <section>
        <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-danger rounded-full animate-pulse" />
          Recently Caught Changes
        </h2>
        <ChangeFeed changes={recentChanges} />
      </section>
    </div>
  );
}
