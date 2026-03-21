export type DiffPart = {
  value: string;
  added?: boolean;
  removed?: boolean;
};

/**
 * Split ingredient text into individual ingredients.
 * Handles commas and semicolons as separators (European lists often use ";").
 * Preserves content inside parentheses (e.g. "Protein Blend (Pea, Hemp)").
 */
function parseIngredients(text: string): string[] {
  const results: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of text) {
    if (char === "(" || char === "[") depth++;
    else if (char === ")" || char === "]") depth--;

    if ((char === "," || char === ";") && depth === 0) {
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
 * Extract all leaf ingredient names from a text, flattening any nesting.
 * "30 % Weizenfladen (Weizenmehl, Wasser, Rapsöl)" yields:
 * ["weizenfladen", "weizenmehl", "wasser", "rapsöl"]
 */
function extractLeafIngredients(text: string): Set<string> {
  const leaves = new Set<string>();

  // Strip parenthesized content markers and flatten
  const flat = text
    .replace(/[()[\]]/g, ",") // turn parens into commas
    .replace(/[;]/g, ",");     // normalize semicolons

  const parts = flat.split(",");
  for (const part of parts) {
    const cleaned = part
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[.,;:]+$/, "")
      .replace(/^\d+[\d.,]*\s*%?\s*/, "") // strip "30 %"
      .replace(/\.$/, "")
      .trim();

    // Skip empty, very short tokens, and allergen disclaimers
    if (
      cleaned.length > 1 &&
      !cleaned.startsWith("kann spuren") &&
      !cleaned.startsWith("may contain")
    ) {
      leaves.add(cleaned);
    }
  }

  return leaves;
}

/**
 * Normalize an ingredient for matching.
 * Normalizes casing, whitespace, trailing/leading punctuation, and
 * percentage prefixes (e.g. "30 % Weizenfladen" → "weizenfladen").
 */
function normalizeIngredient(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:]+$/, "")
    .replace(/^\d+[\d.,]*\s*%?\s*/, "") // strip leading percentages like "30 %"
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

  // Use flattened leaf sets for matching — handles cases where one list
  // nests sub-ingredients in parens and the other lists them flat
  const beforeLeaves = extractLeafIngredients(before);
  const afterLeaves = extractLeafIngredients(after);

  // Check if an ingredient (or its leaf components) exists in a leaf set
  function existsInLeaves(ing: string, leaves: Set<string>): boolean {
    const norm = normalizeIngredient(ing);
    if (leaves.has(norm)) return true;

    // Also check if the main name (before parentheses) is in the set
    const mainName = norm.replace(/\s*\(.*\)$/, "").trim();
    if (mainName && leaves.has(mainName)) return true;

    return false;
  }

  const removed = beforeList.filter(
    (ing) => !existsInLeaves(ing, afterLeaves)
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

    if (existsInLeaves(ing, beforeLeaves)) {
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

  const beforeLeaves = extractLeafIngredients(before);
  const afterLeaves = extractLeafIngredients(after);

  function existsInLeaves(ing: string, leaves: Set<string>): boolean {
    const norm = normalizeIngredient(ing);
    if (leaves.has(norm)) return true;
    const mainName = norm.replace(/\s*\(.*\)$/, "").trim();
    if (mainName && leaves.has(mainName)) return true;
    return false;
  }

  const removed = beforeList.filter((ing) => !existsInLeaves(ing, afterLeaves));
  const added = afterList.filter((ing) => !existsInLeaves(ing, beforeLeaves));

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
  const beforeLeaves = extractLeafIngredients(before);
  const afterLeaves = extractLeafIngredients(after);

  // Check if any leaf ingredient was truly added or removed
  let changed = false;
  beforeLeaves.forEach((leaf) => {
    if (!afterLeaves.has(leaf)) changed = true;
  });
  if (changed) return true;
  afterLeaves.forEach((leaf) => {
    if (!beforeLeaves.has(leaf)) changed = true;
  });

  return changed;
}
