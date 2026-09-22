import type { PosRestFetch } from "../http/server-fetch";

export type ManagementDevice = {
  readonly id: string;
  readonly label: string;
  readonly status: "active" | "inactive";
};

export type ManagementRegister = {
  readonly id: string;
  readonly name: string;
  readonly currency: string;
  readonly status: "active" | "disabled" | "maintenance";
  readonly devices: readonly ManagementDevice[];
};

export type ManagementLocation = {
  readonly id: string;
  readonly name: string;
  readonly registers: readonly ManagementRegister[];
};

export interface ManagementTopologyDirectory {
  listOrganization(input: {
    readonly organizationId: string;
  }): Promise<readonly ManagementLocation[] | "unavailable">;
}

export function createMemoryManagementTopologyDirectory(
  rows: readonly ManagementLocation[] = [],
): ManagementTopologyDirectory {
  return {
    async listOrganization() {
      return rows;
    },
  };
}

export function createSupabaseManagementTopologyDirectory(input: {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly fetchImpl: PosRestFetch;
  readonly timeoutMs?: number;
}): ManagementTopologyDirectory {
  const root = `${input.url.replace(/\/+$/, "")}/rest/v1`;
  const timeoutMs = input.timeoutMs ?? 8_000;
  const headers = {
    apikey: input.serviceRoleKey,
    Authorization: `Bearer ${input.serviceRoleKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  async function get(path: string): Promise<unknown | "unavailable"> {
    try {
      const response = await input.fetchImpl(`${root}/${path}`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) return "unavailable";
      return await response.json();
    } catch {
      return "unavailable";
    }
  }

  return {
    async listOrganization({ organizationId }) {
      const [locationsBody, registersBody, devicesBody] = await Promise.all([
        get(`pos_locations?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,name&order=name.asc`),
        get(`pos_registers?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,location_id,name,currency,status&order=name.asc`),
        get(`pos_devices?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,location_id,label,status&order=label.asc`),
      ]);
      if (
        locationsBody === "unavailable" ||
        registersBody === "unavailable" ||
        devicesBody === "unavailable" ||
        !Array.isArray(locationsBody) ||
        !Array.isArray(registersBody) ||
        !Array.isArray(devicesBody)
      ) {
        return "unavailable";
      }

      return locationsBody.flatMap((row) => {
        if (!record(row) || typeof row.id !== "string" || typeof row.name !== "string") {
          return [];
        }
        const locationId = row.id;
        const devices = devicesBody.flatMap((device) => {
          if (
            !record(device) ||
            device.location_id !== locationId ||
            typeof device.id !== "string" ||
            typeof device.label !== "string" ||
            (device.status !== "active" && device.status !== "inactive")
          ) {
            return [];
          }
          return [{
            id: device.id,
            label: device.label,
            status: device.status,
          } satisfies ManagementDevice];
        });

        const registers = registersBody.flatMap((register) => {
          if (
            !record(register) ||
            register.location_id !== locationId ||
            typeof register.id !== "string" ||
            typeof register.name !== "string" ||
            typeof register.currency !== "string" ||
            !["active", "disabled", "maintenance"].includes(String(register.status))
          ) {
            return [];
          }
          return [{
            id: register.id,
            name: register.name,
            currency: register.currency,
            status: register.status as ManagementRegister["status"],
            // Current schema associates devices to locations, not directly to a register.
            // Surface location devices without inventing a false register binding.
            devices,
          } satisfies ManagementRegister];
        });

        return [{
          id: locationId,
          name: row.name,
          registers,
        } satisfies ManagementLocation];
      });
    },
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
