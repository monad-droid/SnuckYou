import SearchBar from "@/components/SearchBar";
import ChangeFeed from "@/components/ChangeFeed";
import WaitlistForm from "@/components/WaitlistForm";
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

      {/* How It Works */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline font-bold text-3xl text-primary mb-4 text-center">
            How It Works
          </h2>
          <p className="font-body text-on-surface-variant text-center max-w-2xl mx-auto mb-16">
            YouSnuck monitors ingredient lists across thousands of food products
            so you don&apos;t have to read the fine print.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/10">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-primary">sync</span>
              </div>
              <h3 className="font-headline font-bold text-lg text-on-surface mb-3">
                1. We Monitor Continuously
              </h3>
              <p className="font-body text-sm text-on-surface-variant leading-relaxed">
                We regularly pull the latest product data from{" "}
                <span className="font-medium text-on-surface">Open Food Facts</span>,
                a free, open database of food products from around the world.
                When a brand updates their ingredient list, we detect it
                automatically.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/10">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-primary">compare_arrows</span>
              </div>
              <h3 className="font-headline font-bold text-lg text-on-surface mb-3">
                2. We Compare Ingredients
              </h3>
              <p className="font-body text-sm text-on-surface-variant leading-relaxed">
                When we spot a change, we compare the old and new ingredient lists
                side by side. We show you exactly what was{" "}
                <span className="font-medium text-green-700">added</span> and what was{" "}
                <span className="font-medium text-red-700">removed</span>,
                cutting through the noise of minor formatting differences.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/10">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-primary">psychology</span>
              </div>
              <h3 className="font-headline font-bold text-lg text-on-surface mb-3">
                3. AI Analyzes the Change
              </h3>
              <p className="font-body text-sm text-on-surface-variant leading-relaxed">
                An open-source AI model analyzes each ingredient change and
                classifies it as a{" "}
                <span className="font-medium text-green-700">Consumer Benefit</span>,{" "}
                <span className="font-medium text-amber-700">Cost Cutting</span>,{" "}
                <span className="font-medium text-red-700">Health Concern</span>, or{" "}
                <span className="font-medium text-gray-600">Neutral</span>.
                Each verdict includes a confidence score &mdash; low-confidence
                guesses are hidden automatically.
              </p>
            </div>
          </div>

          {/* AI Transparency Note */}
          <div className="mt-12 bg-amber-50 rounded-2xl p-8 border border-amber-200/50 max-w-3xl mx-auto">
            <div className="flex items-start gap-4">
              <span className="material-symbols-outlined text-amber-700 mt-0.5">info</span>
              <div>
                <h4 className="font-headline font-bold text-amber-900 mb-2">
                  About AI Estimates
                </h4>
                <p className="font-body text-sm text-amber-800 leading-relaxed">
                  Our AI verdicts are generated by Llama 3.3, an open-source large
                  language model. They are <span className="font-bold">estimates, not
                  expert opinions</span>. The AI is good at catching obvious patterns
                  (like cocoa butter being replaced with palm oil) but may miss
                  nuance in complex reformulations. Always check the actual
                  ingredient diff for the full picture. Verdicts below 40%
                  confidence are hidden.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Scrutiny Feed */}
      <section id="recent-changes" className="bg-surface-container py-24">
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

      {/* Waitlist CTA */}
      <section className="py-24">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <div className="bg-surface-container-lowest rounded-2xl p-10 border border-outline-variant/10">
            <span className="material-symbols-outlined text-primary text-4xl mb-4 block">
              notifications_active
            </span>
            <h2 className="font-headline font-bold text-3xl text-primary mb-3">
              Stay in the Loop
            </h2>
            <p className="font-body text-on-surface-variant mb-8">
              Get notified when we start tracking a product you care about. Tell
              us what brands or products to watch and we&apos;ll let you know
              when we spot a change.
            </p>
            <WaitlistForm />
          </div>
        </div>
      </section>
    </>
  );
}
