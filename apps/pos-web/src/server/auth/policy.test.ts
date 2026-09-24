import { describe, expect, test } from "vitest";
import {
  DEFAULT_SHIFT_CLOSE_POLICY,
  mayCloseShift,
  resolveShiftClosePolicy,
} from "./policy";

describe("ADR-017 operational policy", () => {
  test("compatibility defaults preserve manager-only close", () => {
    expect(resolveShiftClosePolicy({})).toEqual(DEFAULT_SHIFT_CLOSE_POLICY);
    expect(
      mayCloseShift({
        role: "cashier",
        actorId: "cashier_a",
        shiftCashierId: "cashier_a",
        varianceMinor: 0,
        policy: DEFAULT_SHIFT_CLOSE_POLICY,
      }),
    ).toEqual({ allowed: false, reason: "role_not_allowed" });
    expect(
      mayCloseShift({
        role: "manager",
        actorId: "manager_a",
        shiftCashierId: "cashier_a",
        varianceMinor: 0,
        policy: DEFAULT_SHIFT_CLOSE_POLICY,
      }),
    ).toEqual({ allowed: true });
  });

  test("organization policy may allow cashier zero-variance close", () => {
    const policy = resolveShiftClosePolicy({
      organization: { cashierCanCloseShift: true },
    });
    expect(
      mayCloseShift({
        role: "cashier",
        actorId: "cashier_a",
        shiftCashierId: "cashier_a",
        varianceMinor: 0,
        policy,
      }),
    ).toEqual({ allowed: true });
  });

  test("cashier may be limited to own shift", () => {
    const policy = resolveShiftClosePolicy({
      organization: { cashierCanCloseShift: true, cashierOwnShiftOnly: true },
    });
    expect(
      mayCloseShift({
        role: "cashier",
        actorId: "cashier_b",
        shiftCashierId: "cashier_a",
        varianceMinor: 0,
        policy,
      }),
    ).toEqual({ allowed: false, reason: "cashier_own_shift_only" });
  });

  test("non-zero variance can require manager with tolerance", () => {
    const policy = resolveShiftClosePolicy({
      organization: {
        cashierCanCloseShift: true,
        nonZeroVarianceRequiresManager: true,
        varianceToleranceMinor: 500,
        varianceCurrency: "GHS",
      },
    });
    expect(
      mayCloseShift({
        role: "cashier",
        actorId: "cashier_a",
        shiftCashierId: "cashier_a",
        varianceMinor: 500,
        policy,
      }),
    ).toEqual({ allowed: true });
    expect(
      mayCloseShift({
        role: "cashier",
        actorId: "cashier_a",
        shiftCashierId: "cashier_a",
        varianceMinor: 501,
        policy,
      }),
    ).toEqual({ allowed: false, reason: "manager_required_for_variance" });
  });

  test("register override wins over location and organization", () => {
    const policy = resolveShiftClosePolicy({
      organization: { cashierCanCloseShift: false, managerCanCloseShift: true },
      location: { cashierCanCloseShift: true },
      register: { cashierCanCloseShift: false },
    });
    expect(policy.cashierCanCloseShift).toBe(false);
    expect(policy.managerCanCloseShift).toBe(true);
  });

  test("manager close-other policy is independently configurable", () => {
    const policy = resolveShiftClosePolicy({
      organization: { managerCanCloseOthersShift: false },
    });
    expect(
      mayCloseShift({
        role: "manager",
        actorId: "manager_a",
        shiftCashierId: "cashier_a",
        varianceMinor: 0,
        policy,
      }),
    ).toEqual({ allowed: false, reason: "manager_cannot_close_others" });
  });
});
