import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CatalogBrowser } from "@/app/catalog-ui";

describe("empty Catalog seam", () => {
  test("renders an intentional source-empty state rather than filter advice", () => {
    const html = renderToStaticMarkup(createElement(CatalogBrowser, { products: [], rarities: [] }));

    expect(html).toContain("No Catalog Products are active yet");
    expect(html).toContain("Please check back soon for new extended-art designs.");
    expect(html).not.toContain("Adjust your search or filters");
    expect(html).not.toContain("Reset filters");
  });
});
