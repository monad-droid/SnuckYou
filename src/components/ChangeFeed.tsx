"use client";

import { useState } from "react";
import Link from "next/link";
import { IngredientChange } from "@/lib/supabase";
import { summarizeChange } from "@/lib/diff";
import VerdictBadge from "@/components/VerdictBadge";

const PAGE_SIZE = 12;

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

function parseChangeSummary(summary: string): { added: string[]; removed: string[] } {
  const added: string[] = [];
  const removed: string[] = [];
  const addedMatch = summary.match(/Added: ([^;]+)/);
  const removedMatch = summary.match(/Removed: ([^;]+)/);
  if (addedMatch) added.push(...addedMatch[1].split(", ").map((s) => s.trim()));
  if (removedMatch) removed.push(...removedMatch[1].split(", ").map((s) => s.trim()));
  return { added, removed };
}

export default function ChangeFeed({
  changes,
}: {
  changes: IngredientChange[];
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (changes.length === 0) {
    return (
      <div className="text-center py-12 text-on-surface-variant">
        <p className="text-lg font-headline">No ingredient changes detected yet.</p>
        <p className="text-sm mt-2">
          The monitoring pipeline will catch changes as they happen.
        </p>
      </div>
    );
  }

  const visible = changes.slice(0, visibleCount);
  const hasMore = visibleCount < changes.length;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visible.map((change) => {
          const summary =
            change.ingredients_before && change.ingredients_after
              ? summarizeChange(change.ingredients_before, change.ingredients_after)
              : "Ingredients changed";
          const { added, removed } = parseChangeSummary(summary);

          return (
            <Link
              key={change.id}
              href={`/product/${change.barcode}`}
              className="bg-surface-container-lowest rounded-xl p-6 hover:shadow-lg transition-all border border-outline-variant/10"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-headline font-bold text-on-surface">
                    {change.product_name || "Unknown Product"}
                  </h3>
                  <p className="font-body text-xs text-on-surface-variant">
                    {change.brand || "Unknown Brand"}
                  </p>
                </div>
                <span className="font-body text-[10px] text-outline uppercase tracking-widest">
                  {change.detected_at ? formatTimeAgo(change.detected_at) : ""}
                </span>
              </div>

              {/* AI Verdict — moved to top */}
              <div className="mb-4">
                <VerdictBadge
                  category={change.ai_verdict_category}
                  explanation={change.ai_verdict_explanation}
                  confidence={change.ai_verdict_confidence}
                  compact
                />
              </div>

              <div className="space-y-3 mb-6">
                {added.map((item, i) => (
                  <div
                    key={`add-${i}`}
                    className="bg-secondary-fixed text-on-secondary-fixed-variant px-3 py-2 rounded-lg text-sm flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">add_circle</span>
                    <span className="font-medium">Added: {item}</span>
                  </div>
                ))}
                {removed.map((item, i) => (
                  <div
                    key={`rem-${i}`}
                    className="bg-error-container text-on-error-container px-3 py-2 rounded-lg text-sm flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">do_not_disturb_on</span>
                    <span className="font-medium">Removed: {item}</span>
                  </div>
                ))}
                {added.length === 0 && removed.length === 0 && (
                  <div className="bg-secondary-fixed text-on-secondary-fixed-variant px-3 py-2 rounded-lg text-sm">
                    <span className="font-medium">{summary}</span>
                  </div>
                )}
              </div>

              <span className="block w-full py-2 text-primary font-bold border border-primary/10 rounded-lg hover:bg-primary/5 transition-colors text-center">
                See Full Scrutiny
              </span>
            </Link>
          );
        })}
      </div>

      {hasMore && (
        <div className="text-center mt-10">
          <button
            onClick={(e) => {
              e.preventDefault();
              setVisibleCount((prev) => prev + PAGE_SIZE);
            }}
            className="px-8 py-3 bg-primary text-on-primary font-bold rounded-lg hover:bg-primary/90 transition-colors"
          >
            Show More ({changes.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </>
  );
}
