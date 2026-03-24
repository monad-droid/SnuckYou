import Link from "next/link";

export type WatchlistItem = {
  id: string;
  barcode: string;
  product_name: string | null;
  brand: string | null;
  image_url: string | null;
  receipt_name: string | null;
  added_at: string;
};

export default function WatchlistProductCard({
  item,
  changeCount = 0,
  onRemove,
}: {
  item: WatchlistItem;
  changeCount?: number;
  onRemove: (barcode: string) => void;
}) {
  return (
    <div className="group relative">
      <Link href={`/product/${item.barcode}`} className="block">
        <div className="aspect-square rounded-2xl bg-surface-container mb-4 overflow-hidden relative">
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image_url}
              alt={item.product_name || "Product"}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl">inventory_2</span>
            </div>
          )}
          {changeCount > 0 && (
            <div className="absolute top-3 right-3 botanical-blur bg-error-container text-on-error-container text-[10px] px-2 py-1 rounded-full font-bold uppercase">
              {changeCount} change{changeCount > 1 ? "s" : ""}
            </div>
          )}
        </div>
        <h3 className="font-headline font-bold text-on-surface truncate">
          {item.product_name || item.receipt_name || "Unknown Product"}
        </h3>
        <p className="font-body text-sm text-on-surface-variant truncate">
          {item.brand || "Unknown Brand"}
        </p>
      </Link>
      <button
        onClick={(e) => {
          e.preventDefault();
          onRemove(item.barcode);
        }}
        className="absolute top-2 left-2 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm text-on-surface-variant hover:text-error hover:bg-error-container flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove from watchlist"
      >
        <span className="material-symbols-outlined text-base">close</span>
      </button>
    </div>
  );
}
