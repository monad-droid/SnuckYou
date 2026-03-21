import { getProduct, getProductImageUrl, getProductImages } from "@/lib/openfoodfacts";
import { supabase, IngredientChange } from "@/lib/supabase";
import DiffView from "@/components/DiffView";
import VerdictBadge from "@/components/VerdictBadge";
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
  const allImages = getProductImages(product);

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row gap-16">
          {/* Photo Gallery */}
          <div className="lg:w-1/2 space-y-6">
            <div className="aspect-square rounded-3xl bg-surface-container overflow-hidden">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={product.product_name || "Product"}
                  className="w-full h-full object-contain p-8"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
                  No image available
                </div>
              )}
            </div>
            {allImages.length > 1 && (
              <div className="grid grid-cols-3 gap-4">
                {allImages.map((img, i) => (
                  <a
                    key={img.label}
                    href={img.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`aspect-square rounded-xl bg-surface-container overflow-hidden ${
                      i === 0 ? "ring-2 ring-primary" : "grayscale opacity-50 hover:opacity-100 hover:grayscale-0 transition-all"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={`${product.product_name} - ${img.label}`}
                      className="w-full h-full object-cover"
                    />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Details Content */}
          <div className="lg:w-1/2">
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                {changes.length > 0 && (
                  <span className="bg-secondary-fixed text-on-secondary-fixed-variant text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
                    Scrutinized
                  </span>
                )}
                {changes.length > 0 && changes[0].changed_at && (
                  <span className="text-on-surface-variant font-body text-xs">
                    Last Updated:{" "}
                    {new Date(changes[0].changed_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}
              </div>
              <h1 className="font-headline font-extrabold text-5xl text-primary mb-2">
                {product.product_name || "Unknown Product"}
              </h1>
              <p className="text-xl text-secondary font-medium mb-6">
                {product.brands || "Unknown Brand"}
              </p>
              <div className="flex items-center gap-4 py-4 border-y border-outline-variant/10">
                <div className="text-center">
                  <span className="block font-headline font-bold text-primary">
                    {changes.length}
                  </span>
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">
                    Changes
                  </span>
                </div>
                <div className="h-8 w-px bg-outline-variant/20" />
                <div className="text-center">
                  <span className="block font-headline font-bold text-primary">UPC</span>
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">
                    {product.code}
                  </span>
                </div>
              </div>
            </div>

            {/* Ingredient Scrutiny */}
            <div className="mb-12">
              <h3 className="font-headline font-bold text-xl text-primary mb-6">
                Ingredient Scrutiny
              </h3>
              {product.ingredients_text ? (
                <div className="flex flex-wrap gap-2 leading-relaxed">
                  {product.ingredients_text.split(/,\s*/).map((ingredient, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 rounded-md bg-surface-container-low text-on-surface"
                    >
                      {ingredient}
                      {i < product.ingredients_text!.split(/,\s*/).length - 1 ? "," : ""}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-on-surface-variant italic">
                  No ingredients listed for this product.
                </p>
              )}
            </div>

            {/* Formula History Timeline */}
            <div>
              <h3 className="font-headline font-bold text-xl text-primary mb-6">
                Formula History
              </h3>

              {changes.length === 0 ? (
                <div className="bg-surface-container-lowest rounded-xl p-6 text-center border border-outline-variant/10">
                  <p className="text-on-surface-variant">
                    No ingredient changes detected for this product yet.
                  </p>
                  <p className="text-xs text-on-surface-variant mt-2">
                    Changes will appear here once the monitoring pipeline detects modifications.
                  </p>
                </div>
              ) : (
                <div className="space-y-8 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-outline-variant/30">
                  {changes.map((change, index) => (
                    <div key={change.id} className="relative pl-10">
                      <div
                        className={`absolute left-0 top-1.5 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-white ${
                          index === 0
                            ? "bg-primary"
                            : "bg-surface-container-highest"
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-[14px] ${
                            index === 0 ? "text-on-primary" : "text-on-surface"
                          }`}
                        >
                          {index === 0 ? "sync" : "check"}
                        </span>
                      </div>
                      <div>
                        <p className="font-headline font-bold text-on-surface">
                          Change #{changes.length - index}
                        </p>
                        <p className="text-xs text-on-surface-variant mb-2">
                          {change.changed_at
                            ? new Date(change.changed_at).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })
                            : "Unknown date"}
                          {change.off_revision && ` \u00b7 Revision #${change.off_revision}`}
                        </p>

                        {/* Before/After Label Photos */}
                        {(change.image_before_url || change.image_after_url) && (
                          <div className="grid grid-cols-2 gap-4 mb-3">
                            {change.image_before_url && (
                              <a href={change.image_before_url} target="_blank" rel="noopener noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={change.image_before_url}
                                  alt="Before"
                                  className="w-full rounded-lg border border-outline-variant/10 object-contain bg-white"
                                />
                              </a>
                            )}
                            {change.image_after_url && (
                              <a href={change.image_after_url} target="_blank" rel="noopener noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={change.image_after_url}
                                  alt="After"
                                  className="w-full rounded-lg border border-outline-variant/10 object-contain bg-white"
                                />
                              </a>
                            )}
                          </div>
                        )}

                        {/* Diff */}
                        {change.ingredients_before && change.ingredients_after ? (
                          <div className="bg-surface-container-low rounded-lg p-3">
                            <DiffView
                              before={change.ingredients_before}
                              after={change.ingredients_after}
                            />
                          </div>
                        ) : (
                          <p className="text-sm text-on-surface-variant italic">
                            Diff data unavailable
                          </p>
                        )}

                        {/* AI Verdict */}
                        <div className="mt-3">
                          <VerdictBadge
                            category={change.ai_verdict_category}
                            explanation={change.ai_verdict_explanation}
                            confidence={change.ai_verdict_confidence}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
