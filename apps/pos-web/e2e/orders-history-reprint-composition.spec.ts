import { createServer } from "node:http";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

const outDir = path.join(process.cwd(), "e2e", ".tmp-orders-reprint");
const bundlePath = path.join(outDir, "harness.js");

function buildHarness(): void {
  execFileSync("pnpm", ["exec", "vite", "build", "--config", "e2e/orders-reprint.vite.config.ts"], {
    cwd: process.cwd(),
    stdio: "pipe",
    shell: true,
  });
}

test.describe.configure({ mode: "serial" });

test("baseline checkout-only composition hides Reprint; corrected PosRuntime Orders path reprints with cleanup", async ({
  page,
}) => {
  test.setTimeout(120_000);
  buildHarness();
  const js = readFileSync(bundlePath, "utf8");
  const server = createServer((req, res) => {
    if (req.url === "/harness.js") {
      res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
      res.end(js);
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(`<!doctype html><html><head><meta charset="utf-8" /></head><body>
      <div id="root"></div>
      <script src="/harness.js"></script>
    </body></html>`);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("harness server did not bind");
  const origin = `http://127.0.0.1:${address.port}`;

  await page.addInitScript(() => {
    const media = Object.assign(new EventTarget(), { matches: false });
    window.matchMedia = () => media as MediaQueryList;
  });

  try {
    await page.goto(`${origin}/`);
    await page.waitForFunction(() => typeof window.__reprintHarness !== "undefined");

    // Negative control: prior checkout-only wiring, no scope → Reprint absent.
    for (const authority of ["no-register", "register-no-shift"] as const) {
      await page.evaluate(
        ({ authority }) => {
          window.__reprintHarness!.mount({ mode: "baseline-checkout-only", authority });
        },
        { authority },
      );
      await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
      await page.getByRole("button", { name: "#50317" }).click();
      await expect(page.getByRole("heading", { name: "#50317" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Reprint" })).toHaveCount(0);
      const scope = await page.evaluate(() => window.__reprintHarness!.scope);
      expect(scope).toBeNull();
    }

    // Corrected composition: history ports independent of checkout scope.
    for (const authority of ["no-register", "register-no-shift"] as const) {
      await page.evaluate(
        ({ authority }) => {
          window.__reprintHarness!.mount({ mode: "corrected", authority });
        },
        { authority },
      );
      await page.getByRole("button", { name: "#50317" }).click();
      await expect(page.getByRole("button", { name: "Reprint" })).toBeVisible();

      await page.evaluate(() => {
        const view = window as Window & { print: () => void };
        view.print = () => {
          view.dispatchEvent(new Event("afterprint"));
        };
      });

      await page.getByRole("button", { name: "Reprint" }).click();
      await expect(page.getByText("Print dialog opened.")).toBeVisible({ timeout: 10_000 });
      await expect(page.locator(".receipt-print-host")).toHaveCount(0);

      const afterFirst = await page.evaluate(() => ({
        calls: [...window.__reprintHarness!.calls],
        commercial: [...window.__reprintHarness!.commercial],
      }));
      expect(
        afterFirst.calls.some((c) =>
          c.includes(`/api/pos/v1/receipts/33326bbc-1dd7-4582-8409-ea434942d8db`),
        ),
      ).toBe(true);
      expect(afterFirst.commercial).toEqual([]);

      await page.getByRole("button", { name: "Reprint" }).click();
      await expect(page.getByText("Print dialog opened.")).toBeVisible({ timeout: 10_000 });
      await expect(page.locator(".receipt-print-host")).toHaveCount(0);
      const afterSecond = await page.evaluate(() => ({
        calls: [...window.__reprintHarness!.calls],
        commercial: [...window.__reprintHarness!.commercial],
        scope: window.__reprintHarness!.scope,
      }));
      expect(afterSecond.calls.filter((c) => c.includes("/api/pos/v1/receipts/")).length).toBeGreaterThanOrEqual(2);
      expect(afterSecond.commercial).toEqual([]);
      expect(afterSecond.scope).toBeNull();
    }

    // Presentation-only / signed-out must not obtain authenticated history ports.
    for (const authority of ["presentation-only", "signed-out"] as const) {
      await page.evaluate(
        ({ authority }) => {
          window.__reprintHarness!.mount({ mode: "corrected", authority });
        },
        { authority },
      );
      await page.getByRole("button", { name: "#50317" }).click();
      await expect(page.getByRole("button", { name: "Reprint" })).toHaveCount(0);
    }
  } finally {
    server.close();
  }
});
