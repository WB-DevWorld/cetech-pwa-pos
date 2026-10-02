import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { Uuid } from "../../../../../docs/contracts/domain.generated";
import type { MutationProtectionInput } from "../auth/csrf";
import { assertMutationProtection } from "../auth/csrf";
import { authFailure } from "../auth/errors";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import type { StaffSessionStore } from "../auth/session-store";
import { resolveShiftClosePolicy, type ShiftClosePolicy, type ShiftClosePolicyOverride } from "../auth/policy";
import type { ControlPlaneDirectory } from "./control-plane-directory";
import { loadManagementAuthority } from "./management-authority";
import type {
  OperationalPolicyStore,
  PolicyScope,
} from "./operational-policy-store";

export type OperationalPolicyView = {
  readonly scope: PolicyScope;
  readonly effective: ShiftClosePolicy;
  readonly canManage: boolean;
  readonly valueSource: "explicit" | "inherited";
};

type Common = {
  readonly correlationId: Uuid;
  readonly cookieHeader?: string;
  readonly now: Date;
  readonly sessions: StaffSessionStore;
  readonly assignments: StaffAssignmentDirectory;
  readonly controlPlane: ControlPlaneDirectory;
  readonly policies: OperationalPolicyStore;
  readonly locationId?: string;
  readonly registerId?: string;
};

export async function handleGetOperationalPolicy(
  input: Common,
): Promise<ApiResult<OperationalPolicyView>> {
  const authority = await loadManagementAuthority(input);
  if (!authority.ok) return authority;

  const scope = scopeFor(authority.data.organizationId, input.locationId, input.registerId);
  if (!scope) {
    return authFailure("VALIDATION_ERROR", "register policy requires a location", input.correlationId);
  }
  if (!mayReadScope(authority.data, scope)) {
    return authFailure("FORBIDDEN", "policy scope is outside management authority", input.correlationId);
  }

  const viewed = await readPolicyView(input.policies, scope, authority.data.controlRole);
  if (viewed === "unavailable") {
    return authFailure("INTEGRATION_UNAVAILABLE", "operational policy store is unavailable", input.correlationId);
  }
  return {
    ok: true,
    data: viewed,
    correlationId: input.correlationId,
  };
}

export async function handleSetOperationalPolicy(
  input: Common & {
    readonly protection: MutationProtectionInput;
    readonly override: ShiftClosePolicyOverride;
  },
): Promise<ApiResult<OperationalPolicyView>> {
  const protection = assertMutationProtection(input.protection);
  if (!protection.ok) {
    return authFailure(
      "FORBIDDEN",
      protection.reason === "csrf"
        ? "mutation requires matching CSRF cookie and header"
        : "mutation origin is not allowed",
      input.correlationId,
    );
  }

  const authority = await loadManagementAuthority(input);
  if (!authority.ok) return authority;
  if (authority.data.controlRole !== "owner" && authority.data.controlRole !== "admin") {
    return authFailure("FORBIDDEN", "organization admin authority is required to change policy", input.correlationId);
  }

  const scope = scopeFor(authority.data.organizationId, input.locationId, input.registerId);
  if (!scope) {
    return authFailure("VALIDATION_ERROR", "register policy requires a location", input.correlationId);
  }
  if (!validOverride(input.override)) {
    return authFailure("VALIDATION_ERROR", "operational policy override is invalid", input.correlationId);
  }

  const saved = await input.policies.writeOverride({
    scope,
    override: input.override,
    actorId: authority.data.actorId,
    correlationId: input.correlationId,
  });
  if (saved === "unavailable") {
    return authFailure("INTEGRATION_UNAVAILABLE", "operational policy update was not committed", input.correlationId);
  }

  const viewed = await readPolicyView(input.policies, scope, authority.data.controlRole);
  if (viewed === "unavailable") {
    return authFailure("INTEGRATION_UNAVAILABLE", "operational policy could not be reloaded", input.correlationId);
  }

  return {
    ok: true,
    data: viewed,
    correlationId: input.correlationId,
  };
}

async function readPolicyView(
  policies: OperationalPolicyStore,
  scope: PolicyScope,
  controlRole: string | null,
): Promise<OperationalPolicyView | "unavailable"> {
  const layers = await policies.readLayers(scope);
  if (layers === "unavailable") return "unavailable";
  const effective = resolveShiftClosePolicy(layers);
  const explicit = scope.registerId
    ? layers.register !== undefined
    : scope.locationId
      ? layers.location !== undefined
      : layers.organization !== undefined;
  return {
    scope,
    effective,
    canManage: controlRole === "owner" || controlRole === "admin",
    valueSource: explicit ? "explicit" : "inherited",
  };
}

function scopeFor(
  organizationId: string,
  locationId?: string,
  registerId?: string,
): PolicyScope | null {
  if (registerId && !locationId) return null;
  return {
    organizationId,
    ...(locationId ? { locationId } : {}),
    ...(registerId ? { registerId } : {}),
  };
}

function mayReadScope(
  authority: {
    readonly controlRole: string | null;
    readonly managerLocationIds: readonly string[];
  },
  scope: PolicyScope,
): boolean {
  if (authority.controlRole === "owner" || authority.controlRole === "admin") return true;
  if (authority.controlRole === "support") return false;
  return Boolean(scope.locationId && authority.managerLocationIds.includes(scope.locationId));
}

function validOverride(value: ShiftClosePolicyOverride): boolean {
  if (
    value.varianceToleranceMinor !== undefined &&
    (!Number.isSafeInteger(value.varianceToleranceMinor) || value.varianceToleranceMinor < 0)
  ) {
    return false;
  }
  if (
    (value.varianceToleranceMinor === undefined) !==
    (value.varianceCurrency === undefined)
  ) {
    return false;
  }
  if (
    value.varianceCurrency !== undefined &&
    !/^[A-Z]{3}$/.test(value.varianceCurrency)
  ) {
    return false;
  }
  return true;
}
