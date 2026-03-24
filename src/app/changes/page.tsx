import { Metadata } from "next";
import ChangesTable from "@/components/ChangesTable";

export const metadata: Metadata = {
  title: "Recent Changes",
  description:
    "Track ingredient shifts, additive changes, and formula updates across thousands of food brands in real-time.",
};

export default function ChangesPage() {
  return (
    <div className="max-w-screen-2xl mx-auto px-6 md:px-12 pt-8 pb-24">
      {/* Hero Header */}
      <section className="mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="bg-brand-highlight text-primary text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest inline-block mb-3">
              Live Intelligence
            </span>
            <h1 className="font-headline text-5xl md:text-7xl font-extrabold tracking-tighter leading-none mb-4 text-primary">
              Recent Changes
            </h1>
            <p className="max-w-2xl text-lg text-primary/70 leading-relaxed font-body">
              Tracking botanical shifts, ingredient substitutions, and brand
              reformulations across the global supply chain in real-time.
            </p>
          </div>
        </div>
      </section>

      {/* Table — starts empty, fetches client-side */}
      <ChangesTable initialChanges={[]} initialTotalCount={0} />
    </div>
  );
}
