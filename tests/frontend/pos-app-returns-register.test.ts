import { describe, expect, test, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "fake-indexeddb/auto";
import type { ApiResult, RegisterPort, ReturnPort } from "../../docs/contracts/ports";
import type {
  ReturnPreview,
  ReturnResolution,
  Shift,
} from "../../docs/contracts/domain.generated";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { ReturnsRuntimeScreen } from "../../apps/pos-web/src/app/returns-runtime";
import { RegisterRuntimeScreen } from "../../apps/pos-web/src/app/register-runtime";
import { createBrowserReturnPort, createBrowserRegisterPort } from "../../apps/pos-web/src/app/checkout-client";
import { PosRuntime } from "../../apps/pos-web/src/app/pos-app";

const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function success<T>(data: T): ApiResult<T> {
  return { ok: true, data, correlationId: CORRELATION };
}

function previewData(): ReturnPreview {
  return {
    returnId: "r1111111-1111-4111-8111-111111111111",
    saleId: "sale-hist-1",
    economicsVersion: "0123456789abcdef0123456789abcdef",
    refundTotal: { minor: 1500, currency: "GHS" },
    approvalRequired: false,
    fingerprint: "fp-return-1",
    expiresAt: "2099-01-01T00:00:00.000Z",
    lines: [
      {
        orderLineId: "ol-1",
        requestedQuantity: "1",
        remainingReturnableQuantity: "1",
        condition: "resellable",
        intendedDisposition: "restock_sellable",
        dispositionPolicy: "automatic_sellable_restock",
      },
    ],
  };
}

function resolution(status: ReturnResolution["status"] = "completed"): ReturnResolution {
  if (status === "completed") {
    return {
      returnId: "r1111111-1111-4111-8111-111111111111",
      status: "completed",
      cashRefund: { effectId: "eff-1", status: "completed" },
      providerRefund: { status: "not_required" },
      commercialRefund: { effectId: "eff-1", status: "completed" },
      stockDisposition: { status: "not_required" },
    };
  }
  return {
    returnId: "r1111111-1111-4111-8111-111111111111",
    status,
    cashRefund: { effectId: "eff-1", status: "pending" },
    providerRefund: { status: "not_required" },
    commercialRefund: { effectId: "eff-1", status: "pending" },
    stockDisposition: { status: "not_required" },
  };
}

describe("R8-01 returns and register app composition", () => {
  test("/returns mounts the accepted Returns UI instead of the R4 placeholder", () => {
    const returns: ReturnPort = {
      preview: vi.fn(async () => success(previewData())),
      execute: vi.fn(async () => success(resolution())),
      resolve: vi.fn(async () => success(resolution())),
    };
    const html = renderToStaticMarkup(
      createElement(ReturnsRuntimeScreen, {
        returns,
        lookup: { search: async () => [] },
      }),
    );
    expect(html).toContain("Returns");
    expect(html).not.toContain("This workspace is not part of the R4 Sell runtime.");
    const app = renderToStaticMarkup(
      createElement(PosRuntime, { route: "returns", onNavigate: () => undefined }),
    );
    expect(app).toContain("Staff sign-in");
    expect(app).not.toContain("Staff member");
    expect(app).not.toContain("This workspace is not part of the R4 Sell runtime.");
  });

  test("/register mounts the accepted Register UI instead of the R4 placeholder", () => {
    const register: RegisterPort = {
      get: vi.fn(),
      activeShift: vi.fn(async () => success(null)),
      open: vi.fn(),
      cashMovement: vi.fn(),
      close: vi.fn(),
      report: vi.fn(),
    };
    const html = renderToStaticMarkup(
      createElement(RegisterRuntimeScreen, {
        register,
        registerId: "reg-front-1",
        deviceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        currency: "GHS",
      }),
    );
    expect(html).toContain("Open register");
    expect(html).not.toContain("This workspace is not part of the R4 Sell runtime.");
    const app = renderToStaticMarkup(
      createElement(PosRuntime, { route: "register", onNavigate: () => undefined }),
    );
    expect(app).toContain("Staff sign-in");
    expect(app).not.toContain("Staff member");
    expect(app).not.toContain("This workspace is not part of the R4 Sell runtime.");
    expect(html).not.toContain('name="expectedCash"');
  });

  test("browser ReturnPort hits canonical BFF routes and reuses the execute idempotency key", async () => {
    const calls: Array<{ url: string; method: string; idempotency?: string | null }> = [];
    const fetchImpl: typeof fetch = (async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      calls.push({ url, method: init?.method ?? "GET", idempotency: headers.get("idempotency-key") });
      const body =
        url.includes("/preview")
          ? success(previewData())
          : url.includes("/execute") || url.includes("/returns/")
            ? success(resolution(url.includes("/execute") ? "in_progress" : "completed"))
            : success(resolution());
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const port = createBrowserReturnPort({ fetchImpl });
    const previewed = await port.preview({
      saleId: "sale-hist-1",
      lines: [{ orderLineId: "ol-1", quantity: "1", reason: "x", condition: "resellable" }],
    });
    expect(previewed.ok).toBe(true);
    const key = "66666666-6666-4666-8666-666666666601";
    await port.execute(
      { returnId: "r1111111-1111-4111-8111-111111111111", fingerprint: "fp-return-1" },
      { idempotencyKey: key, correlationId: CORRELATION },
    );
    await port.execute(
      { returnId: "r1111111-1111-4111-8111-111111111111", fingerprint: "fp-return-1" },
      { idempotencyKey: key, correlationId: CORRELATION },
    );
    const resolved = await port.resolve("r1111111-1111-4111-8111-111111111111");
    expect(resolved.ok).toBe(true);
    expect(calls.map((call) => call.url)).toEqual([
      "/api/pos/v1/returns/preview",
      "/api/pos/v1/returns/execute",
      "/api/pos/v1/returns/execute",
      "/api/pos/v1/returns/r1111111-1111-4111-8111-111111111111",
    ]);
    expect(calls[1]?.idempotency).toBe(key);
    expect(calls[2]?.idempotency).toBe(key);
  });

  test("browser RegisterPort submits counted cash only and reads expected cash from the server", async () => {
    const calls: string[] = [];
    const openShift = (): Shift => ({
      id: "s1111111-1111-4111-8111-111111111111",
      registerId: "reg-front-1",
      deviceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      cashierId: "cashier-1",
      status: "open",
      openingFloat: { minor: 50000, currency: "GHS" },
      openedAt: "2026-09-15T08:00:00.000Z",
    });
    const fetchImpl: typeof fetch = (async (input, init) => {
      const url = String(input);
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.includes("/close")) {
        const posted = JSON.parse(String(init?.body ?? "{}")) as { countedCash?: unknown; expectedCash?: unknown };
        expect(posted.expectedCash).toBeUndefined();
        expect(posted.countedCash).toEqual({ minor: 48000, currency: "GHS" });
        return new Response(
          JSON.stringify(
            success({
              ...openShift(),
              status: "closed",
              countedCash: { minor: 48000, currency: "GHS" },
              expectedCash: { minor: 50000, currency: "GHS" },
              variance: { minor: -2000, currency: "GHS" },
              closedAt: "2026-09-15T18:00:00.000Z",
            }),
          ),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify(success(openShift())), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const port = createBrowserRegisterPort({ fetchImpl });
    await port.activeShift("reg-front-1");
    await port.close(
      { shiftId: "s1111111-1111-4111-8111-111111111111", countedCash: { minor: 48000, currency: "GHS" } },
      { idempotencyKey: "k1", correlationId: CORRELATION },
    );
    expect(calls[0]).toContain("/api/pos/v1/registers/reg-front-1/active-shift");
    expect(calls[1]).toContain("/api/pos/v1/shifts/close");
  });
});
