"use client";

import Link from "next/link";
import { IngredientChange } from "@/lib/supabase";
import { summarizeChange } from "@/lib/diff";

export default function ChangeFeed({
  changes,
}: {
  changes: IngredientChange[];
}) {
  if (changes.length === 0) {
    return (
      <div className="text-center py-12 text-muted">
        <p className="text-lg">No ingredient changes detected yet.</p>
        <p className="text-sm mt-2">
          The monitoring pipeline will catch changes as they happen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {changes.map((change) => (
        <Link
          key={change.id}
          href={`/product/${change.barcode}`}
          className="block bg-card border border-card-border rounded-lg p-4 hover:border-accent/50 transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {change.product_name || "Unknown Product"}
              </h3>
              <p className="text-sm text-muted">
                {change.brand || "Unknown Brand"}
              </p>
              <p className="text-sm text-accent mt-1">
                {change.ingredients_before && change.ingredients_after
                  ? summarizeChange(
                      change.ingredients_before,
                      change.ingredients_after
                    )
                  : "Ingredients changed"}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="inline-block bg-danger/20 text-danger text-xs px-2 py-1 rounded-full font-medium">
                Changed
              </span>
              <p className="text-xs text-muted mt-1">
                {change.detected_at
                  ? new Date(change.detected_at).toLocaleDateString()
                  : ""}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
