import { searchProducts } from "@/lib/openfoodfacts";
import { supabase } from "@/lib/supabase";
import SearchBar from "@/components/SearchBar";
import ProductCard from "@/components/ProductCard";

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

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const query = searchParams.q || "";
  const page = parseInt(searchParams.page || "1", 10);

  if (!query.trim()) {
    return (
      <div className="space-y-6">
        <SearchBar />
        <p className="text-muted text-center py-12">
          Enter a search term to find products.
        </p>
      </div>
    );
  }

  const results = await searchProducts(query, page);
  const barcodes = results.products.map((p) => p.code);
  const changedBarcodes = await getBarcodesWithChanges(barcodes);

  return (
    <div className="space-y-6">
      <SearchBar initialQuery={query} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {results.count.toLocaleString()} results for &ldquo;{query}&rdquo;
        </p>
      </div>

      {results.products.length === 0 ? (
        <p className="text-muted text-center py-12">
          No products found. Try a different search term.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {results.products.map((product) => (
            <ProductCard
              key={product.code}
              product={product}
              hasChanges={changedBarcodes.has(product.code)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex justify-center gap-4 py-6">
        {page > 1 && (
          <a
            href={`/search?q=${encodeURIComponent(query)}&page=${page - 1}`}
            className="px-4 py-2 bg-card border border-card-border rounded-lg text-sm hover:border-accent transition-colors"
          >
            Previous
          </a>
        )}
        {results.page_count > page && (
          <a
            href={`/search?q=${encodeURIComponent(query)}&page=${page + 1}`}
            className="px-4 py-2 bg-card border border-card-border rounded-lg text-sm hover:border-accent transition-colors"
          >
            Next
          </a>
        )}
      </div>
    </div>
  );
}
