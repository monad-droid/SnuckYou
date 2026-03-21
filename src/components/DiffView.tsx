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
    <div className="font-mono text-sm leading-relaxed">
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
