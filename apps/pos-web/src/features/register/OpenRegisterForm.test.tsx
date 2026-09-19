import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { OpenRegisterForm } from "./OpenRegisterForm";

const registers = [
  { id: "reg-main", name: "Front Counter 1", locationLabel: "Main store" },
  { id: "reg-spare", name: "Spare Counter", locationLabel: "Main store" },
];

describe("OpenRegisterForm", () => {
  test("renders register selection, opening-float input, and online-required copy", () => {
    const html = renderToStaticMarkup(
      createElement(OpenRegisterForm, {
        registers,
        online: true,
        onSubmit: () => undefined,
      }),
    );
    expect(html).toContain("Open register");
    expect(html).toContain("Front Counter 1");
    expect(html).toContain("opening-float");
    expect(html).toContain("Recorded as the opening float for the shift.");
    expect(html).not.toContain("staffId");
    expect(html).not.toContain("Ama Mensah");
    expect(html).toContain('id="opening-float"');
    expect(html).toContain('type="submit"');
  });

  test("disables submit and explains when offline", () => {
    const html = renderToStaticMarkup(
      createElement(OpenRegisterForm, {
        registers,
        online: false,
        onSubmit: () => undefined,
      }),
    );
    expect(html).toContain("Connection required to open a register.");
    expect(html).toContain("disabled");
  });

  test("renders adapter-supplied submit errors", () => {
    const html = renderToStaticMarkup(
      createElement(OpenRegisterForm, {
        registers,
        errorMessage: "Register is already open.",
        onSubmit: () => undefined,
      }),
    );
    expect(html).toContain("Register is already open.");
    expect(html).toContain('role="alert"');
  });

  test("shows submitting state", () => {
    const html = renderToStaticMarkup(
      createElement(OpenRegisterForm, {
        registers,
        submitting: true,
        onSubmit: () => undefined,
      }),
    );
    expect(html).toContain("Opening…");
  });
});
