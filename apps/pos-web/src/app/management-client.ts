"use client";

import type { ApiResult } from "../../../../docs/contracts/ports";
import type { ManagementContext } from "../server/admin/management-context";
import type { StaffAccessRecord } from "../server/admin/staff-access-directory";
import type { OperationalPolicyView } from "../server/admin/handle-operational-policy";
import type { ManagementLocation } from "../server/admin/management-topology-directory";
import type { ManagementShiftCashView } from "../server/admin/management-shift-cash-directory";
import type { StaffAssignmentMutationResult } from "../server/admin/staff-assignment-admin-store";
import type { ControlMembershipMutationResult } from "../server/admin/control-membership-admin-store";
import type { StaffAccessStatusMutationResult } from "../server/admin/staff-access-status-admin-store";
import type { StaffInviteResult } from "../server/admin/handle-invite-staff";
import type { ShiftClosePolicyOverride } from "../server/auth/policy";
import { STAFF_CSRF_COOKIE, STAFF_CSRF_HEADER } from "../config/auth";

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return trimmed.slice(name.length + 1);
    }
  }
  return "";
}

async function jsonResult<T>(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  const correlationId = crypto.randomUUID();
  try {
    const response = await fetchImpl(url, {
      credentials: "include",
      ...init,
      headers: {
        "x-correlation-id": correlationId,
        ...(init.headers ?? {}),
      },
    });
    return (await response.json()) as ApiResult<T>;
  } catch {
    return {
      ok: false,
      error: {
        code: "INTEGRATION_UNAVAILABLE",
        message: "Management request failed.",
        retryable: true,
        nextAction: "resolve",
      },
      correlationId,
    };
  }
}

export function fetchManagementContext(fetchImpl: typeof fetch = fetch) {
  return jsonResult<ManagementContext>(fetchImpl, "/api/pos/v1/admin/context");
}

export function fetchStaffAccess(fetchImpl: typeof fetch = fetch) {
  return jsonResult<readonly StaffAccessRecord[]>(fetchImpl, "/api/pos/v1/admin/staff");
}

export function fetchOperationalPolicy(
  input: { readonly locationId?: string; readonly registerId?: string },
  fetchImpl: typeof fetch = fetch,
) {
  const params = new URLSearchParams();
  if (input.locationId) params.set("locationId", input.locationId);
  if (input.registerId) params.set("registerId", input.registerId);
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return jsonResult<OperationalPolicyView>(fetchImpl, `/api/pos/v1/admin/policy${query}`);
}

export function updateOperationalPolicy(
  input: {
    readonly scope: { readonly locationId?: string; readonly registerId?: string };
    readonly override: ShiftClosePolicyOverride;
  },
  fetchImpl: typeof fetch = fetch,
) {
  const params = new URLSearchParams();
  if (input.scope.locationId) params.set("locationId", input.scope.locationId);
  if (input.scope.registerId) params.set("registerId", input.scope.registerId);
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return jsonResult<OperationalPolicyView>(
    fetchImpl,
    `/api/pos/v1/admin/policy${query}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        [STAFF_CSRF_HEADER]: readCookie(STAFF_CSRF_COOKIE),
      },
      body: JSON.stringify(input.override),
    },
  );
}


export function fetchManagementTopology(fetchImpl: typeof fetch = fetch) {
  return jsonResult<readonly ManagementLocation[]>(fetchImpl, "/api/pos/v1/admin/topology");
}

export function fetchManagementShiftsCash(fetchImpl: typeof fetch = fetch) {
  return jsonResult<ManagementShiftCashView>(fetchImpl, "/api/pos/v1/admin/shifts-cash");
}

export function updateStaffAssignment(
  input: {
    readonly actorId: string;
    readonly locationId: string;
    readonly role: "cashier" | "manager";
    readonly registerIds: readonly string[];
  },
  fetchImpl: typeof fetch = fetch,
) {
  return jsonResult<StaffAssignmentMutationResult>(
    fetchImpl,
    `/api/pos/v1/admin/staff/${encodeURIComponent(input.actorId)}/assignment`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        [STAFF_CSRF_HEADER]: readCookie(STAFF_CSRF_COOKIE),
      },
      body: JSON.stringify({
        locationId: input.locationId,
        role: input.role,
        registerIds: input.registerIds,
      }),
    },
  );
}


export function updateControlMembership(
  input: {
    readonly actorId: string;
    readonly controlRole: "owner" | "admin" | "support";
    readonly status: "active" | "disabled";
  },
  fetchImpl: typeof fetch = fetch,
) {
  return jsonResult<ControlMembershipMutationResult>(
    fetchImpl,
    `/api/pos/v1/admin/staff/${encodeURIComponent(input.actorId)}/control-membership`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        [STAFF_CSRF_HEADER]: readCookie(STAFF_CSRF_COOKIE),
      },
      body: JSON.stringify({
        controlRole: input.controlRole,
        status: input.status,
      }),
    },
  );
}


export function updateStaffAccessStatus(
  input: {
    readonly actorId: string;
    readonly status: "active" | "disabled";
    readonly reason?: string;
  },
  fetchImpl: typeof fetch = fetch,
) {
  return jsonResult<StaffAccessStatusMutationResult>(
    fetchImpl,
    `/api/pos/v1/admin/staff/${encodeURIComponent(input.actorId)}/access-status`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        [STAFF_CSRF_HEADER]: readCookie(STAFF_CSRF_COOKIE),
      },
      body: JSON.stringify({
        status: input.status,
        ...(input.reason ? { reason: input.reason } : {}),
      }),
    },
  );
}


export function inviteStaff(
  input: {
    readonly email: string;
    readonly displayName: string;
  },
  fetchImpl: typeof fetch = fetch,
) {
  return jsonResult<StaffInviteResult>(
    fetchImpl,
    "/api/pos/v1/admin/staff/invite",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [STAFF_CSRF_HEADER]: readCookie(STAFF_CSRF_COOKIE),
      },
      body: JSON.stringify(input),
    },
  );
}
