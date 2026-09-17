import { describe, expect, test } from "vitest";
import { createReturnController } from "../../../apps/pos-web/src/features/returns/returnController";
import { createBrowserHistoricReturnSaleLookup } from "../../../apps/pos-web/src/app/returns-runtime";
import { createBrowserReturnPort } from "../../../apps/pos-web/src/app/checkout-client";
import { handleGetHistoricReturnSale } from "../../../apps/pos-web/src/server/returns/handle-get-historic-return-sale";
import { handlePreviewReturn } from "../../../apps/pos-web/src/server/returns/handle-preview-return";
import { projectHistoricReturnSale } from "../../../apps/pos-web/src/server/returns/historic-sale-projection";
import {
  CORRELATION,
  CSRF,
  LINE_1,
  NOW,
  ORIGIN,
  TX_A,
  cashierAssignments,
  createRt01Runtime,
  staffCookies,
} from "./helpers";

function fabricatedReceiptIdentity(saleId: string, index = 0): string {
  return `${saleId}:receipt:${index}`;
}

describe("R8-02 historic return-sale lookup", () => {
  test("production lookup returns durable orderLineId and real preview accepts it", async () => {
    const runtime = await createRt01Runtime();
    const durable = await runtime.checkoutStore.getSaleBySaleId("org_a", "woo-rt01");
    expect(durable?.status).toBe("completed");
    const durableOrderLineId = durable?.orderLines?.[0]?.orderLineId;
    expect(durableOrderLineId).toBe(LINE_1);
    expect(durableOrderLineId).not.toBe(fabricatedReceiptIdentity("woo-rt01"));

    const projected = projectHistoricReturnSale(durable!);
    expect(projected?.lines[0]?.orderLineId).toBe(LINE_1);
    expect(projected?.lines[0]?.orderLineId).not.toContain(":receipt:");

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      const common = {
        correlationIdHeader: headers.get("x-correlation-id") ?? CORRELATION,
        origin: ORIGIN,
        referer: null as string | null,
        cookieHeader: runtime.sessions.cookieHeader,
        csrfHeader: headers.get("x-csrf-token") || CSRF,
        now: NOW,
        sessionStore: runtime.sessions.store,
        allowedOrigins: [ORIGIN],
        checkoutStore: runtime.checkoutStore,
        assignments: cashierAssignments(),
      };
      if (url.includes("/api/pos/v1/returns/history/")) {
        const encoded = url.slice(url.indexOf("/history/") + "/history/".length);
        const result = await handleGetHistoricReturnSale({
          ...common,
          saleKey: decodeURIComponent(encoded.split("?")[0] ?? ""),
        });
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/api/pos/v1/returns/preview")) {
        const result = await handlePreviewReturn({
          ...common,
          body: init?.body ? JSON.parse(String(init.body)) : null,
          returnStore: runtime.returnStore,
        });
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`unexpected lookup/preview url ${url}`);
    };

    Object.defineProperty(globalThis, "document", {
      value: { cookie: runtime.sessions.cookieHeader },
      configurable: true,
    });

    const lookup = createBrowserHistoricReturnSaleLookup({ fetchImpl });
    const matches = await lookup.search("woo-rt01");
    expect(matches).toHaveLength(1);
    expect(matches[0]?.lines[0]?.orderLineId).toBe(durableOrderLineId);
    expect(matches[0]?.lines[0]?.orderLineId).not.toBe(fabricatedReceiptIdentity("woo-rt01"));
    expect(matches[0]?.saleId).toBe("woo-rt01");

    const controller = createReturnController({
      returns: createBrowserReturnPort({ fetchImpl }),
    });
    controller.selectSale(matches[0]!);
    controller.updateLine(durableOrderLineId!, {
      quantity: "1",
      reason: "customer changed mind",
      condition: "resellable",
    });
    await controller.preview();
    const session = controller.getSession();
    expect(session.stage).toBe("previewed");
    expect(session.previewLines[0]?.orderLineId).toBe(LINE_1);
    expect(session.refundTotal?.minor).toBe(1500);
  });

  test("out-of-scope completed sale is not exposed", async () => {
    const runtime = await createRt01Runtime();
    const outsider = await staffCookies({
      actorId: "cashier_b",
      displayName: "Cashier B",
      organizationId: "org_b",
      locationIds: ["loc_b1"],
    });
    const result = await handleGetHistoricReturnSale({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      cookieHeader: outsider.cookieHeader,
      csrfHeader: CSRF,
      saleKey: TX_A,
      now: NOW,
      sessionStore: outsider.store,
      allowedOrigins: [ORIGIN],
      checkoutStore: runtime.checkoutStore,
      assignments: cashierAssignments(),
    });
    expect(result.body.ok).toBe(false);
    if (result.body.ok) {
      return;
    }
    expect(["FORBIDDEN", "NOT_FOUND"]).toContain(result.body.error.code);
  });

  test("fabricated receipt-position identity is rejected by real preview", async () => {
    const runtime = await createRt01Runtime();
    const result = await handlePreviewReturn({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      cookieHeader: runtime.sessions.cookieHeader,
      csrfHeader: CSRF,
      body: {
        saleId: "woo-rt01",
        lines: [
          {
            orderLineId: fabricatedReceiptIdentity("woo-rt01"),
            quantity: "1",
            reason: "customer changed mind",
            condition: "resellable",
          },
        ],
      },
      now: NOW,
      sessionStore: runtime.sessions.store,
      allowedOrigins: [ORIGIN],
      checkoutStore: runtime.checkoutStore,
      returnStore: runtime.returnStore,
      assignments: cashierAssignments(),
    });
    expect(result.body.ok).toBe(false);
    if (result.body.ok) {
      return;
    }
    expect(result.body.error.code).toBe("VALIDATION_ERROR");
  });
});
