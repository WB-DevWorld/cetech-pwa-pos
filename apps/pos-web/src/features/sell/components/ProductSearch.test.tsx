import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ProductSearch } from "./ProductSearch";

describe("ProductSearch toolbar", () => {
  test("keeps F2 Search and the accessible label without a visible Scan button", () => {
    const html = renderToStaticMarkup(
      createElement(ProductSearch, {
        query: "",
        onQueryChange: () => undefined,
        onSearchSubmit: () => undefined,
      }),
    );
    expect(html).toContain("F2 Search");
    expect(html).toContain("Barcode, SKU or product name");
    expect(html).toContain("Scan barcode or search products, SKU");
    expect(html).toContain('id="product-search"');
    expect(html).not.toContain(">Scan<");
    expect(html).not.toContain("Hardener");
    expect(html).not.toContain("Demo controls");
  });
});
