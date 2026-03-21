export type OFFProduct = {
  code: string;
  product_name?: string;
  brands?: string;
  ingredients_text?: string;
  ingredients?: unknown[];
  image_url?: string;
  image_front_url?: string;
  image_front_small_url?: string;
  categories_tags?: string[];
  countries_tags?: string[];
  last_modified_t?: number;
  rev?: number;
  last_modified_by?: string;
};

export type OFFSearchResult = {
  count: number;
  page: number;
  page_count: number;
  page_size: number;
  products: OFFProduct[];
};

const OFF_API_BASE = "https://world.openfoodfacts.org";

export async function searchProducts(
  query: string,
  page: number = 1
): Promise<OFFSearchResult> {
  const params = new URLSearchParams({
    search_terms: query,
    json: "1",
    action: "process",
    page: String(page),
    page_size: "24",
    fields:
      "code,product_name,brands,ingredients_text,image_url,image_front_url,image_front_small_url,categories_tags,last_modified_t,rev",
  });

  const res = await fetch(`${OFF_API_BASE}/cgi/search.pl?${params}`, {
    next: { revalidate: 300 },
    headers: { "User-Agent": "SnuckYou/1.0 (contact@snuckyou.app)" },
  });

  if (!res.ok) throw new Error(`OFF API error: ${res.status}`);
  return res.json();
}

export async function getProduct(barcode: string): Promise<OFFProduct | null> {
  const res = await fetch(
    `${OFF_API_BASE}/api/v2/product/${encodeURIComponent(barcode)}.json`,
    {
      next: { revalidate: 300 },
      headers: { "User-Agent": "SnuckYou/1.0 (contact@snuckyou.app)" },
    }
  );

  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 1) return null;
  return data.product as OFFProduct;
}

export function getProductImageUrl(product: OFFProduct): string | null {
  return (
    product.image_front_url ||
    product.image_url ||
    product.image_front_small_url ||
    null
  );
}
