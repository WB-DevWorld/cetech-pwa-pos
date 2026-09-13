/** Catalog search/barcode helpers. Barcode/SKU remain strings; leading zeroes are preserved. */

export function preserveBarcode(value: string): string {
  return value;
}

export function normalizeSearchText(...parts: ReadonlyArray<string | undefined>): string {
  return parts
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function searchHaystackIncludes(haystack: string, needle: string): boolean {
  const normalizedNeedle = normalizeSearchText(needle);
  if (!normalizedNeedle) {
    return true;
  }
  return haystack.includes(normalizedNeedle);
}
