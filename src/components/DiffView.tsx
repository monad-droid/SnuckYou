"use client";

import { computeIngredientDiff, DiffPart } from "@/lib/diff";

export default function DiffView({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  const parts: DiffPart[] = computeIngredientDiff(before, after);

  return (
    <div className="font-body text-sm leading-relaxed flex flex-wrap gap-1">
      {parts.map((part, i) => {
        if (part.added) {
          return (
            <span key={i} className="diff-added">
              {part.value}
            </span>
          );
        }
        if (part.removed) {
          return (
            <span key={i} className="diff-removed">
              {part.value}
            </span>
          );
        }
        return (
          <span key={i} className="diff-unchanged">
            {part.value}
          </span>
        );
      })}
    </div>
  );
}
