import { diffWords } from "diff";

export type DiffPart = {
  value: string;
  added?: boolean;
  removed?: boolean;
};

export function computeIngredientDiff(
  before: string,
  after: string
): DiffPart[] {
  return diffWords(before, after);
}

export function summarizeChange(before: string, after: string): string {
  const parts = computeIngredientDiff(before, after);
  const added: string[] = [];
  const removed: string[] = [];

  for (const part of parts) {
    const trimmed = part.value.trim();
    if (!trimmed) continue;
    if (part.added) added.push(trimmed);
    if (part.removed) removed.push(trimmed);
  }

  const summaryParts: string[] = [];
  if (removed.length > 0) {
    const preview =
      removed.length <= 2
        ? removed.join(", ")
        : `${removed.slice(0, 2).join(", ")} +${removed.length - 2} more`;
    summaryParts.push(`Removed: ${preview}`);
  }
  if (added.length > 0) {
    const preview =
      added.length <= 2
        ? added.join(", ")
        : `${added.slice(0, 2).join(", ")} +${added.length - 2} more`;
    summaryParts.push(`Added: ${preview}`);
  }

  return summaryParts.join(" · ") || "Ingredients reformulated";
}

export function isSignificantChange(before: string, after: string): boolean {
  const normalizeForComparison = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const normalizedBefore = normalizeForComparison(before);
  const normalizedAfter = normalizeForComparison(after);

  if (normalizedBefore === normalizedAfter) return false;

  // Minimum character difference threshold
  const minDiffLength = 3;
  const parts = diffWords(normalizedBefore, normalizedAfter);
  let totalChangedChars = 0;
  for (const part of parts) {
    if (part.added || part.removed) {
      totalChangedChars += part.value.trim().length;
    }
  }

  return totalChangedChars >= minDiffLength;
}
