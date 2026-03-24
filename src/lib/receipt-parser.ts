export type ReceiptItem = {
  upc: string;
  name: string;
};

/**
 * Extract UPC codes and product names from receipt text.
 * Receipt format: UPC code (8-14 digits) at start of line, followed by product name.
 * Example: "7143000933   DOLE SALAD       3.39  F"
 */
export function extractReceiptItems(text: string): ReceiptItem[] {
  const items: ReceiptItem[] = [];
  const seen = new Set<string>();

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    // Match: 8-14 digit code at start, then whitespace, then product name, then price
    const match = trimmed.match(/^(\d{8,14})\s+(.+?)\s+[\d.]+\s*[A-Z]?\s*$/);
    if (!match) continue;

    const upc = match[1];
    const name = match[2].trim();

    // Skip duplicates
    if (seen.has(upc)) continue;
    seen.add(upc);

    items.push({ upc, name });
  }

  return items;
}
