import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import HomePage from "./page";

describe("CP-05 scaffold root page", () => {
  test("renders the engineering scaffold heading and non-production notice", () => {
    const html = renderToStaticMarkup(createElement(HomePage));
    expect(html).toContain("CETECH POS engineering scaffold");
    expect(html).toContain("not the approved production POS UI");
    expect(html).not.toContain("Pay");
  });
});
