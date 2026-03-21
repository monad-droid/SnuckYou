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
    <Link href={`/product/${product.code}`} className="group cursor-pointer block">
      <div className="aspect-square rounded-2xl bg-surface-container mb-4 overflow-hidden relative">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={product.product_name || "Product"}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-on-surface-variant text-sm">
            No image
          </div>
        )}
        <div
          className={`absolute top-3 right-3 botanical-blur text-[10px] px-2 py-1 rounded-full font-bold uppercase ${
            hasChanges
              ? "bg-error-container text-on-error-container"
              : "bg-white/90 text-primary"
          }`}
        >
          {hasChanges ? "Modified" : "No Changes"}
        </div>
      </div>
      <h3 className="font-headline font-bold text-on-surface truncate">
        {product.product_name || "Unknown Product"}
      </h3>
      <p className="font-body text-sm text-on-surface-variant truncate">
        {product.brands || "Unknown Brand"}
      </p>
    </Link>
  );
}
