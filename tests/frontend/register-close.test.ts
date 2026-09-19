import { describe, expect, test, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ApiFailure, ApiResult, Shift, ShiftReport } from "../../docs/contracts/domain.generated";
import { createRegisterController } from "../../apps/pos-web/src/features/register/registerController";
import { CloseShiftForm } from "../../apps/pos-web/src/features/register/CloseShiftForm";
import { OpenRegisterForm } from "../../apps/pos-web/src/features/register/OpenRegisterForm";
import { RegisterScreen } from "../../apps/pos-web/src/features/register/RegisterScreen";
import { idleShiftWorkspace } from "../../apps/pos-web/src/features/register/shiftView";

const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SHIFT = "s1111111-1111-4111-8111-111111111111";
const DEVICE = "d1111111-1111-4111-8111-111111111111";

function success<T>(data: T): ApiResult<T> {
  return { ok: true, data, correlationId: CORRELATION };
}

function failure(nextAction: ApiFailure["error"]["nextAction"], message: string): ApiFailure {
  return {
    ok: false,
    correlationId: CORRELATION,
    error: { code: "REQUIRES_ATTENTION", message, retryable: false, nextAction },
  };
}

function openShift(status: Shift["status"] = "open"): Shift {
  return {
    id: SHIFT,
    registerId: "reg-main",
    deviceId: DEVICE,
    cashierId: "cashier-1",
    status,
    openingFloat: { minor: 50000, currency: "GHS" },
    openedAt: "2026-09-15T08:00:00.000Z",
  };
}

function closedShift(): Shift {
  return {
    ...openShift("closed"),
    countedCash: { minor: 48000, currency: "GHS" },
    expectedCash: { minor: 50000, currency: "GHS" },
    variance: { minor: -2000, currency: "GHS" },
    closedAt: "2026-09-15T18:00:00.000Z",
    zReportId: "z-1",
  };
}

function uuidSequence(values: string[]): () => string {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? values[0]!;
}

const registers = [{ id: "reg-main", name: "Front Counter 1", locationLabel: "Main store" }];

describe("FE-06 register close", () => {
  test("24 opening register preserves OpenRegisterForm behavior", () => {
    const html = renderToStaticMarkup(
      createElement(RegisterScreen, {
        openForm: { registers, online: true, onSubmit: () => undefined },
        session: idleShiftWorkspace(),
        inFlight: false,
      }),
    );
    expect(html).toContain("Open register");
    expect(html).toContain("opening-float");
    expect(html).toContain("Recorded as the opening float for the shift.");
    expect(html).toContain('data-shift-status="no_open_shift"');
    const original = renderToStaticMarkup(
      createElement(OpenRegisterForm, { registers, online: true, onSubmit: () => undefined }),
    );
    expect(original).toContain("Open register");
    expect(original).toContain("opening-float");
  });

  test("25 blind close accepts counted cash, not expected cash", () => {
    const html = renderToStaticMarkup(createElement(CloseShiftForm, { onSubmit: () => undefined }));
    expect(html).toContain("closing-count");
    expect(html).toContain("Cash counted");
    expect(html).toContain("Count drawer cash");
    expect(html).not.toContain('id="expected');
    expect(html).not.toContain("name=\"expectedCash\"");
    expect(html).not.toContain("<label for=\"expected");
    expect(html).not.toMatch(/<input[^>]+id="expected/);
  });

  test("26 expected cash cannot be edited or client-invented", async () => {
    const close = vi.fn(async () => success(closedShift()));
    const controller = createRegisterController({
      register: {
        get: vi.fn(),
        activeShift: vi.fn(async () => success(openShift())),
        open: vi.fn(),
        cashMovement: vi.fn(),
        close,
        report: vi.fn(),
      },
      registerId: "reg-main",
      deviceId: DEVICE,
      currency: "GHS",
      createUuid: uuidSequence(["k1", "c1"]),
    });
    await controller.load();
    expect(controller.getSession().expectedCash).toBeUndefined();
    const html = renderToStaticMarkup(
      createElement(RegisterScreen, {
        openForm: { registers, onSubmit: () => undefined },
        session: controller.getSession(),
        inFlight: false,
        onClose: () => undefined,
      }),
    );
    expect(html).toContain("closing-count");
    expect(html).not.toContain("data-closed-expected");
    expect(html).not.toContain('name="expectedCash"');
  });

  test("27 expected cash and variance after close come from the server response", async () => {
    const close = vi.fn(async () => success(closedShift()));
    const report = vi.fn(async (): Promise<ApiResult<ShiftReport>> =>
      success({
        id: "z-1",
        shiftId: SHIFT,
        kind: "Z",
        expectedCash: { minor: 50000, currency: "GHS" },
        countedCash: { minor: 48000, currency: "GHS" },
        variance: { minor: -2000, currency: "GHS" },
        createdAt: "2026-09-15T18:01:00.000Z",
      }),
    );
    const controller = createRegisterController({
      register: {
        get: vi.fn(),
        activeShift: vi.fn(async () => success(openShift())),
        open: vi.fn(),
        cashMovement: vi.fn(),
        close,
        report,
      },
      registerId: "reg-main",
      deviceId: DEVICE,
      currency: "GHS",
      createUuid: uuidSequence(["k1", "c1"]),
    });
    await controller.load();
    await controller.close("480.00");
    expect(close.mock.calls[0]?.[0]).toEqual({ shiftId: SHIFT, countedCash: { minor: 48000, currency: "GHS" }, approvalId: undefined });
    expect(controller.getSession().expectedCash).toEqual({ minor: 50000, currency: "GHS" });
    expect(controller.getSession().variance).toEqual({ minor: -2000, currency: "GHS" });
    expect(controller.getSession().countedCash).toEqual({ minor: 48000, currency: "GHS" });
    const html = renderToStaticMarkup(
      createElement(RegisterScreen, {
        openForm: { registers, onSubmit: () => undefined },
        session: controller.getSession(),
        inFlight: false,
      }),
    );
    expect(html).toContain("data-closed-expected");
    expect(html).toContain("data-closed-variance");
    expect(html).toContain("GHS 500.00");
  });

  test("28 close double-submit calls close once", async () => {
    let release!: (value: ApiResult<Shift>) => void;
    const pending = new Promise<ApiResult<Shift>>((resolve) => {
      release = resolve;
    });
    const close = vi.fn(async () => pending);
    const controller = createRegisterController({
      register: {
        get: vi.fn(),
        activeShift: vi.fn(async () => success(openShift())),
        open: vi.fn(),
        cashMovement: vi.fn(),
        close,
        report: vi.fn(),
      },
      registerId: "reg-main",
      deviceId: DEVICE,
      currency: "GHS",
      createUuid: uuidSequence(["k1", "c1"]),
    });
    await controller.load();
    const first = controller.close("480.00");
    await Promise.resolve();
    const second = controller.close("480.00");
    release(success(closedShift()));
    await first;
    await second;
    expect(close).toHaveBeenCalledTimes(1);
  });

  test("29 close failure leaves the shift unresolved", async () => {
    const close = vi.fn(async () => failure("none", "Drawer still open on another device."));
    const controller = createRegisterController({
      register: {
        get: vi.fn(),
        activeShift: vi.fn(async () => success(openShift())),
        open: vi.fn(),
        cashMovement: vi.fn(),
        close,
        report: vi.fn(),
      },
      registerId: "reg-main",
      deviceId: DEVICE,
      currency: "GHS",
      createUuid: uuidSequence(["k1", "c1"]),
    });
    await controller.load();
    await controller.close("480.00");
    expect(controller.getSession().status).toBe("open");
    expect(controller.getSession().closeSucceeded).toBe(false);
    expect(controller.getSession().expectedCash).toBeUndefined();
  });

  test("30 requires_attention is not shown as successfully closed", async () => {
    const close = vi.fn(async () =>
      success({
        ...openShift("requires_attention"),
        countedCash: { minor: 40000, currency: "GHS" },
        expectedCash: { minor: 50000, currency: "GHS" },
        variance: { minor: -10000, currency: "GHS" },
      }),
    );
    const controller = createRegisterController({
      register: {
        get: vi.fn(),
        activeShift: vi.fn(async () => success(openShift())),
        open: vi.fn(),
        cashMovement: vi.fn(),
        close,
        report: vi.fn(),
      },
      registerId: "reg-main",
      deviceId: DEVICE,
      currency: "GHS",
      createUuid: uuidSequence(["k1", "c1"]),
    });
    await controller.load();
    await controller.close("400.00");
    expect(controller.getSession().status).toBe("requires_attention");
    expect(controller.getSession().closeSucceeded).toBe(false);
    const html = renderToStaticMarkup(
      createElement(RegisterScreen, {
        openForm: { registers, onSubmit: () => undefined },
        session: controller.getSession(),
        inFlight: false,
      }),
    );
    expect(html).toContain("It is not closed.");
    expect(html).not.toContain("data-shift-closed");
    expect(html).toContain('data-close-succeeded="false"');
  });
});
