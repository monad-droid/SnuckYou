import Link from "next/link";
import { OFFProduct, getProductImageUrl } from "@/lib/openfoodfacts";

export default function ProductCard({
  product,
  hasChanges = false,
}: {
  product: OFFProduct;
  hasChanges?: boolean;
}) {
  const imageUrl = getProductImageUrl(product);

  return (
    <Link
      href={`/product/${product.code}`}
      className="bg-card border border-card-border rounded-lg overflow-hidden hover:border-accent/50 transition-colors group"
    >
      <div className="aspect-square bg-black/30 relative flex items-center justify-center">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={product.product_name || "Product"}
            className="object-contain w-full h-full p-4"
          />
        ) : (
          <div className="text-muted text-sm">No image</div>
        )}
        {hasChanges && (
          <span className="absolute top-2 right-2 bg-danger text-white text-xs px-2 py-1 rounded-full font-bold">
            CHANGED
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-foreground text-sm truncate group-hover:text-accent transition-colors">
          {product.product_name || "Unknown Product"}
        </h3>
        <p className="text-xs text-muted truncate">
          {product.brands || "Unknown Brand"}
        </p>
      </div>
    </Link>
  );
}
