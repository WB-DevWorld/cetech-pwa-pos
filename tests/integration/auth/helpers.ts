import { createMemoryAssignmentDirectory } from "../../../apps/pos-web/src/server/auth/assignments";
import type { StaffIdentityClaims } from "../../../apps/pos-web/src/server/auth/claims";
import type { IdentityVerifyResult } from "../../../apps/pos-web/src/server/auth/identity-verifier";

export const CORRELATION = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
export const ORIGIN = "https://pos.example.test";

export function futureExpiry(hours = 1): string {
  return new Date(Date.now() + hours * 3600_000).toISOString();
}

export function pastExpiry(): string {
  return new Date(Date.now() - 60_000).toISOString();
}

export function cashierClaims(overrides: Partial<StaffIdentityClaims> = {}): StaffIdentityClaims {
  return {
    actorId: "cashier_a",
    displayName: "Cashier A",
    organizationId: "org_a",
    locationIds: ["loc_a1"],
    registerId: "reg_a",
    capabilities: ["ui.hint.only"],
    expiresAt: futureExpiry(),
    ...overrides,
  };
}

export function verified(identity: StaffIdentityClaims = cashierClaims()): IdentityVerifyResult {
  return { ok: true, identity };
}

export function directory() {
  return createMemoryAssignmentDirectory([
    {
      actorId: "cashier_a",
      organizationId: "org_a",
      locationIds: ["loc_a1"],
      registerIds: ["reg_a"],
    },
  ]);
}

export function mutation(overrides: {
  origin?: string | null;
  csrf?: string;
  csrfHeader?: string | null;
} = {}) {
  const csrf = overrides.csrf ?? "csrf-token";
  return {
    origin: overrides.origin === undefined ? ORIGIN : overrides.origin,
    referer: null,
    csrfCookie: csrf,
    csrfHeader: overrides.csrfHeader === undefined ? csrf : overrides.csrfHeader,
    allowedOrigins: [ORIGIN],
  };
}
