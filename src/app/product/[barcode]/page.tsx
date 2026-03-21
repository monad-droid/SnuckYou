import { getProduct, getProductImageUrl } from "@/lib/openfoodfacts";
import { supabase, IngredientChange } from "@/lib/supabase";
import DiffView from "@/components/DiffView";
import { notFound } from "next/navigation";

async function getChangeHistory(barcode: string): Promise<IngredientChange[]> {
  try {
    const { data, error } = await supabase
      .from("ingredient_changes")
      .select("*")
      .eq("barcode", barcode)
      .order("changed_at", { ascending: false });

    if (error) throw error;
    return (data as IngredientChange[]) || [];
  } catch {
    return [];
  }
}

export default async function ProductPage({
  params,
}: {
  params: { barcode: string };
}) {
  const product = await getProduct(params.barcode);
  if (!product) notFound();

  const changes = await getChangeHistory(params.barcode);
  const imageUrl = getProductImageUrl(product);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Product Header */}
      <div className="flex flex-col sm:flex-row gap-6">
        <div className="w-full sm:w-48 h-48 bg-card border border-card-border rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={product.product_name || "Product"}
              className="object-contain w-full h-full p-4"
            />
          ) : (
            <span className="text-muted text-sm">No image</span>
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">
            {product.product_name || "Unknown Product"}
          </h1>
          <p className="text-muted text-lg">
            {product.brands || "Unknown Brand"}
          </p>
          <p className="text-xs text-muted mt-2">Barcode: {product.code}</p>
          {changes.length > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 bg-danger/20 text-danger text-sm px-3 py-1.5 rounded-full font-medium">
              <span className="w-2 h-2 bg-danger rounded-full" />
              {changes.length} ingredient change{changes.length !== 1 ? "s" : ""}{" "}
              detected
            </div>
          )}
        </div>
      </div>

      {/* Current Ingredients */}
      <section>
        <h2 className="text-lg font-bold text-foreground mb-3">
          Current Ingredients
        </h2>
        <div className="bg-card border border-card-border rounded-lg p-4">
          {product.ingredients_text ? (
            <p className="text-sm leading-relaxed text-foreground/80">
              {product.ingredients_text}
            </p>
          ) : (
            <p className="text-sm text-muted italic">
              No ingredients listed for this product.
            </p>
          )}
        </div>
      </section>

      {/* Change History */}
      <section>
        <h2 className="text-lg font-bold text-foreground mb-3">
          Ingredient Change History
        </h2>

        {changes.length === 0 ? (
          <div className="bg-card border border-card-border rounded-lg p-6 text-center">
            <p className="text-muted">
              No ingredient changes detected for this product yet.
            </p>
            <p className="text-xs text-muted mt-2">
              Changes will appear here once the monitoring pipeline detects
              modifications.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {changes.map((change, index) => (
              <div
                key={change.id}
                className="bg-card border border-card-border rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-foreground">
                    Change #{changes.length - index}
                  </span>
                  <div className="text-right">
                    <span className="text-xs text-muted">
                      {change.changed_at
                        ? new Date(change.changed_at).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            }
                          )
                        : "Unknown date"}
                    </span>
                    {change.off_revision && (
                      <span className="text-xs text-muted block">
                        Revision #{change.off_revision}
                      </span>
                    )}
                  </div>
                </div>
                <div className="border-t border-card-border pt-3">
                  {change.ingredients_before && change.ingredients_after ? (
                    <DiffView
                      before={change.ingredients_before}
                      after={change.ingredients_after}
                    />
                  ) : (
                    <p className="text-sm text-muted italic">
                      Diff data unavailable
                    </p>
                  )}
                </div>
                {/* Legend */}
                <div className="flex gap-4 mt-3 text-xs">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-success/20 border border-success/30 rounded" />
                    Added
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-danger/20 border border-danger/30 rounded" />
                    Removed
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-muted/20 border border-muted/30 rounded" />
                    Unchanged
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
