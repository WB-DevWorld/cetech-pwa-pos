import type { StaffAssignmentRole } from "./roles";

export const ORGANIZATION_CONTROL_ROLES = ["owner", "admin", "support"] as const;
export type OrganizationControlRole = (typeof ORGANIZATION_CONTROL_ROLES)[number];

export type ShiftClosePolicy = {
  readonly cashierCanCloseShift: boolean;
  readonly managerCanCloseShift: boolean;
  readonly cashierOwnShiftOnly: boolean;
  readonly managerCanCloseOthersShift: boolean;
  readonly nonZeroVarianceRequiresManager: boolean;
  readonly varianceToleranceMinor?: number;
  readonly varianceCurrency?: string;
};

export type ShiftClosePolicyOverride = Partial<ShiftClosePolicy>;

export type OperationalPolicyLayers = {
  readonly organization?: ShiftClosePolicyOverride;
  readonly location?: ShiftClosePolicyOverride;
  readonly register?: ShiftClosePolicyOverride;
};

/** ADR-017 compatibility defaults preserve the pre-#105 runtime until configured. */
export const DEFAULT_SHIFT_CLOSE_POLICY: ShiftClosePolicy = {
  cashierCanCloseShift: false,
  managerCanCloseShift: true,
  cashierOwnShiftOnly: true,
  managerCanCloseOthersShift: true,
  nonZeroVarianceRequiresManager: true,
};

export function resolveShiftClosePolicy(layers: OperationalPolicyLayers): ShiftClosePolicy {
  return {
    ...DEFAULT_SHIFT_CLOSE_POLICY,
    ...defined(layers.organization),
    ...defined(layers.location),
    ...defined(layers.register),
  };
}

export type ShiftCloseDecisionInput = {
  readonly role: StaffAssignmentRole;
  readonly actorId: string;
  readonly shiftCashierId: string;
  readonly varianceMinor: number;
  readonly policy: ShiftClosePolicy;
};

export type ShiftCloseDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly reason:
        | "role_not_allowed"
        | "cashier_own_shift_only"
        | "manager_cannot_close_others"
        | "manager_required_for_variance";
    };

export function mayCloseShift(input: ShiftCloseDecisionInput): ShiftCloseDecision {
  const isOwnShift = input.actorId === input.shiftCashierId;
  if (input.role === "cashier") {
    if (!input.policy.cashierCanCloseShift) {
      return { allowed: false, reason: "role_not_allowed" };
    }
    if (input.policy.cashierOwnShiftOnly && !isOwnShift) {
      return { allowed: false, reason: "cashier_own_shift_only" };
    }
    const tolerance = input.policy.varianceToleranceMinor ?? 0;
    if (
      input.policy.nonZeroVarianceRequiresManager &&
      Math.abs(input.varianceMinor) > tolerance
    ) {
      return { allowed: false, reason: "manager_required_for_variance" };
    }
    return { allowed: true };
  }

  if (!input.policy.managerCanCloseShift) {
    return { allowed: false, reason: "role_not_allowed" };
  }
  if (!input.policy.managerCanCloseOthersShift && !isOwnShift) {
    return { allowed: false, reason: "manager_cannot_close_others" };
  }
  return { allowed: true };
}

export function isOrganizationControlRole(value: unknown): value is OrganizationControlRole {
  return typeof value === "string" && (ORGANIZATION_CONTROL_ROLES as readonly string[]).includes(value);
}

function defined<T extends object>(value: Partial<T> | undefined): Partial<T> {
  if (!value) return {};
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}
