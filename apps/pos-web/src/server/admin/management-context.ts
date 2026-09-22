import type { StaffLocationRole } from "../auth/assignments";
import type { OrganizationControlRole } from "../auth/policy";

export const MANAGEMENT_SECTIONS = [
  "overview",
  "staff_access",
  "locations",
  "registers",
  "devices",
  "shifts_cash",
  "returns_approvals",
  "system_health",
  "audit",
  "policies",
] as const;

export type ManagementSection = (typeof MANAGEMENT_SECTIONS)[number];

export type ManagementContext = {
  readonly actorId: string;
  readonly displayName: string;
  readonly organizationId: string;
  readonly controlRole: OrganizationControlRole | null;
  readonly managerLocationIds: readonly string[];
  readonly locationRoles: readonly StaffLocationRole[];
  readonly sections: readonly ManagementSection[];
};

const FULL_ADMIN: readonly ManagementSection[] = MANAGEMENT_SECTIONS;
const SUPPORT: readonly ManagementSection[] = ["overview", "system_health", "audit"];
const MANAGER: readonly ManagementSection[] = [
  "overview",
  "staff_access",
  "registers",
  "devices",
  "shifts_cash",
  "returns_approvals",
  "system_health",
  "audit",
];

export function resolveManagementSections(input: {
  readonly controlRole: OrganizationControlRole | null;
  readonly locationRoles: readonly StaffLocationRole[];
}): readonly ManagementSection[] {
  if (input.controlRole === "owner" || input.controlRole === "admin") {
    return FULL_ADMIN;
  }
  if (input.controlRole === "support") {
    return SUPPORT;
  }
  if (input.locationRoles.some((row) => row.role === "manager")) {
    return MANAGER;
  }
  return [];
}
