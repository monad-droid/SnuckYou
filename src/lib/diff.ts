export type DiffPart = {
  value: string;
  added?: boolean;
  removed?: boolean;
};

/**
 * Split ingredient text into individual ingredients.
 * Handles commas inside parentheses (e.g. "Protein Blend (Pea, Hemp)").
 */
function parseIngredients(text: string): string[] {
  const results: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of text) {
    if (char === "(") depth++;
    else if (char === ")") depth--;

    if (char === "," && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) results.push(trimmed);
      current = "";
    } else {
      current += char;
    }
  }
  const trimmed = current.trim();
  if (trimmed) results.push(trimmed);

  return results;
}

/**
 * Normalize an ingredient for exact matching.
 * Only normalizes casing, whitespace, and trailing punctuation — NOT the words
 * themselves, so "TOMATOES" and "Roma tomato paste" remain different.
 */
function normalizeIngredient(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:]+$/, "")
    .trim();
}

/**
 * Compute an ingredient-level diff.
 * Compares ingredients as comma-separated items. Items that moved position
 * but still exist in both lists are shown as unchanged. Only truly added
 * or removed ingredients are flagged.
 */
export function computeIngredientDiff(
  before: string,
  after: string
): DiffPart[] {
  const beforeList = parseIngredients(before);
  const afterList = parseIngredients(after);

  // Build normalized sets for membership checks
  const beforeNormSet = new Set(beforeList.map(normalizeIngredient));
  const afterNormSet = new Set(afterList.map(normalizeIngredient));

  // Find removed ingredients (in before, not in after)
  const removed = beforeList.filter(
    (ing) => !afterNormSet.has(normalizeIngredient(ing))
  );

  const parts: DiffPart[] = [];

  // Show removed ingredients first (strikethrough)
  for (let i = 0; i < removed.length; i++) {
    if (i > 0) parts.push({ value: ", ", removed: true });
    parts.push({ value: removed[i], removed: true });
  }

  // Separator between removed and the after list
  if (removed.length > 0 && afterList.length > 0) {
    parts.push({ value: " " });
  }

  // Walk through the after list
  for (let i = 0; i < afterList.length; i++) {
    if (i > 0) parts.push({ value: ", " });
    const ing = afterList[i];
    const norm = normalizeIngredient(ing);

    if (beforeNormSet.has(norm)) {
      parts.push({ value: ing });
    } else {
      parts.push({ value: ing, added: true });
    }
  }

  return parts;
}

export function summarizeChange(before: string, after: string): string {
  const beforeList = parseIngredients(before);
  const afterList = parseIngredients(after);
  const beforeNormSet = new Set(beforeList.map(normalizeIngredient));
  const afterNormSet = new Set(afterList.map(normalizeIngredient));

  const removed = beforeList.filter(
    (ing) => !afterNormSet.has(normalizeIngredient(ing))
  );
  const added = afterList.filter(
    (ing) => !beforeNormSet.has(normalizeIngredient(ing))
  );

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
  const beforeList = parseIngredients(before);
  const afterList = parseIngredients(after);
  const beforeNormSet = new Set(beforeList.map(normalizeIngredient));
  const afterNormSet = new Set(afterList.map(normalizeIngredient));

  // Find truly added/removed ingredients (not just moved)
  const removed = beforeList.filter(
    (ing) => !afterNormSet.has(normalizeIngredient(ing))
  );
  const added = afterList.filter(
    (ing) => !beforeNormSet.has(normalizeIngredient(ing))
  );

  // No real additions or removals = not significant (just reordering)
  return removed.length > 0 || added.length > 0;
}
