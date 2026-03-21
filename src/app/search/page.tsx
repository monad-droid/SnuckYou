import { Suspense } from "react";
import { searchProducts, getProduct } from "@/lib/openfoodfacts";
import { supabase } from "@/lib/supabase";
import SearchBar from "@/components/SearchBar";
import ProductCard from "@/components/ProductCard";
import WaitlistForm from "@/components/WaitlistForm";
import { redirect } from "next/navigation";

function looksLikeBarcode(q: string): boolean {
  return /^\d{8,14}$/.test(q);
}

async function getBarcodesWithChanges(
  barcodes: string[]
): Promise<Set<string>> {
  if (barcodes.length === 0) return new Set();
  try {
    const { data } = await supabase
      .from("ingredient_changes")
      .select("barcode")
      .in("barcode", barcodes);
    return new Set((data || []).map((d: { barcode: string }) => d.barcode));
  } catch {
    return new Set();
  }
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-square rounded-2xl bg-surface-container-high mb-4" />
          <div className="h-4 w-3/4 bg-surface-container-high rounded mb-2" />
          <div className="h-3 w-1/2 bg-surface-container-high rounded" />
        </div>
      ))}
    </div>
  );
}

async function ProductResults({ query, page }: { query: string; page: number }) {
  if (looksLikeBarcode(query.trim())) {
    const product = await getProduct(query.trim());
    if (product) {
      redirect(`/product/${encodeURIComponent(query.trim())}`);
    }
  }

  const results = await searchProducts(query, page);

  const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const filteredProducts = results.products.filter((p) => {
    const text = `${p.product_name || ""} ${p.brands || ""} ${(p.categories_tags || []).join(" ")}`.toLowerCase();
    return searchTerms.every((term) => text.includes(term));
  });

  const barcodes = filteredProducts.map((p) => p.code);
  const changedBarcodes = await getBarcodesWithChanges(barcodes);

  return (
    <>
      <p className="font-body text-on-surface-variant mb-8">
        Showing {filteredProducts.length} products for &ldquo;{query}&rdquo;
      </p>

      {filteredProducts.length === 0 ? (
        <p className="text-on-surface-variant text-center py-12">
          No products found. Try a different search term.
        </p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.code}
              product={product}
              hasChanges={changedBarcodes.has(product.code)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex justify-center gap-4 py-12">
        {page > 1 && (
          <a
            href={`/search?q=${encodeURIComponent(query)}&page=${page - 1}`}
            className="px-6 py-3 bg-surface-container-lowest border border-outline-variant/10 rounded-full text-sm font-headline font-bold text-primary hover:shadow-lg transition-all"
          >
            Previous
          </a>
        )}
        {results.page_count > page && (
          <a
            href={`/search?q=${encodeURIComponent(query)}&page=${page + 1}`}
            className="px-6 py-3 bg-primary text-on-primary rounded-full text-sm font-headline font-bold hover:scale-95 transition-all"
          >
            Next
          </a>
        )}
      </div>
    </>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const query = searchParams.q || "";
  const page = parseInt(searchParams.page || "1", 10);

  if (!query.trim()) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-24">
        <SearchBar />
        <p className="text-on-surface-variant text-center py-12">
          Enter a search term to find products.
        </p>
      </div>
    );
  }

  return (
    <div className="py-24 max-w-7xl mx-auto px-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h2 className="font-headline font-bold text-3xl text-primary">
            Search Results
          </h2>
        </div>
      </div>

      {/* Data coverage banner */}
      <div className="mb-8 bg-primary-fixed/30 border border-primary/10 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <span className="material-symbols-outlined text-primary mt-0.5">info</span>
          <div>
            <p className="font-body text-sm text-on-surface leading-relaxed">
              Changes since <span className="font-bold">3/7/2025</span> will be listed below.
              Unfortunately we were not tracking candy up until this point.
              Our database will grow as our site stays live. Join the waitlist if
              you&apos;d like to add your products to track in the future.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <SearchBar initialQuery={query} />
      </div>

      <Suspense fallback={<ProductGridSkeleton />}>
        <ProductResults query={query} page={page} />
      </Suspense>

      {/* Waitlist Section */}
      <section className="mt-12 bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/10">
        <div className="max-w-xl mx-auto text-center">
          <span className="material-symbols-outlined text-primary text-4xl mb-4 block">notification_add</span>
          <h3 className="font-headline font-bold text-xl text-on-surface mb-2">
            Want to track a product we don&apos;t have?
          </h3>
          <p className="font-body text-sm text-on-surface-variant mb-6">
            Join the waitlist and tell us which products or brands you&apos;d like us to monitor.
            We&apos;ll notify you when we start tracking them.
          </p>
          <WaitlistForm />
        </div>
      </section>
    </div>
  );
}
