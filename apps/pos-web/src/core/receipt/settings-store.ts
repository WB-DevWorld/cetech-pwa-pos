import type { ReceiptSettings } from "../../../../../docs/contracts/domain.generated";
import { DEFAULT_RECEIPT_SETTINGS, isReceiptSettings } from "./settings";

export interface ReceiptSettingsStore {
  get(organizationId: string, locationId: string): Promise<ReceiptSettings>;
  upsert(organizationId: string, locationId: string, settings: ReceiptSettings): Promise<ReceiptSettings>;
}

export interface MutableReceiptSettingsStore extends ReceiptSettingsStore {
  seed(organizationId: string, locationId: string, settings: ReceiptSettings): void;
}

function settingsKey(organizationId: string, locationId: string): string {
  return `${organizationId}\u0000${locationId}`;
}

export function createMemoryReceiptSettingsStore(
  initial: ReadonlyArray<{
    readonly organizationId: string;
    readonly locationId: string;
    readonly settings: ReceiptSettings;
  }> = [],
): MutableReceiptSettingsStore {
  const rows = new Map<string, ReceiptSettings>();
  for (const row of initial) {
    rows.set(settingsKey(row.organizationId, row.locationId), row.settings);
  }
  return {
    seed(organizationId, locationId, settings) {
      rows.set(settingsKey(organizationId, locationId), settings);
    },
    async get(organizationId, locationId) {
      return rows.get(settingsKey(organizationId, locationId)) ?? DEFAULT_RECEIPT_SETTINGS;
    },
    async upsert(organizationId, locationId, settings) {
      if (!isReceiptSettings(settings)) {
        throw new Error("receipt settings are invalid");
      }
      rows.set(settingsKey(organizationId, locationId), settings);
      return settings;
    },
  };
}
