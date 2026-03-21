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
    return [];
  }
}

export const revalidate = 60;

export default async function Home() {
  const recentChanges = await getRecentChanges();

  return (
    <>
      {/* Hero Section */}
      <section className="relative pt-24 pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
          <h1 className="font-headline font-extrabold text-5xl md:text-7xl text-primary tracking-tight mb-6">
            We watch what <br />
            <span className="bg-brand-highlight px-4 py-1 inline-block font-bold">
              they snuck in
            </span>
          </h1>
          <p className="font-body text-lg text-on-surface-variant max-w-2xl mx-auto mb-12">
            Transparency in every bite. Track ingredient shifts, additive
            changes, and formula updates across thousands of food brands.
          </p>
          <SearchBar large />
        </div>
        {/* Decorative Organic Shapes */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary-fixed/30 rounded-full blur-[100px] -z-0" />
        <div className="absolute top-1/2 -left-24 w-64 h-64 bg-secondary-fixed/30 rounded-full blur-[80px] -z-0" />
      </section>

      {/* Live Scrutiny Feed */}
      <section className="bg-surface-container py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="font-headline font-bold text-3xl text-primary mb-2">
                Live Scrutiny Feed
              </h2>
              <p className="font-body text-on-surface-variant">
                Real-time alerts for formula modifications
              </p>
            </div>
          </div>
          <ChangeFeed changes={recentChanges} />
        </div>
      </section>
    </>
  );
}
