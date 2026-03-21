import { searchProducts, getProduct } from "@/lib/openfoodfacts";
import { supabase } from "@/lib/supabase";
import SearchBar from "@/components/SearchBar";
import ProductCard from "@/components/ProductCard";
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

  // If it looks like a barcode, try direct product lookup first
  if (looksLikeBarcode(query.trim())) {
    const product = await getProduct(query.trim());
    if (product) {
      redirect(`/product/${encodeURIComponent(query.trim())}`);
    }
    // If not found, fall through to regular search
  }

  const results = await searchProducts(query, page);

  // Filter results to only include products that match ALL search terms
  const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const filteredProducts = results.products.filter((p) => {
    const text = `${p.product_name || ""} ${p.brands || ""} ${(p.categories_tags || []).join(" ")}`.toLowerCase();
    return searchTerms.every((term) => text.includes(term));
  });

  const barcodes = filteredProducts.map((p) => p.code);
  const changedBarcodes = await getBarcodesWithChanges(barcodes);

  return (
    <div className="space-y-6">
      <SearchBar initialQuery={query} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {filteredProducts.length} results for &ldquo;{query}&rdquo;
        </p>
      </div>

      {filteredProducts.length === 0 ? (
        <p className="text-muted text-center py-12">
          No products found. Try a different search term.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
