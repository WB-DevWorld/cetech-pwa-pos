const STORAGE_KEY = "cetech_pos_device_id";

/**
 * Stable local device identifier for OpenShiftRequest. Sign-out must not rotate it.
 * Server device membership remains authoritative.
 */
export function readOrCreateLocalDeviceId(): string {
  if (typeof window === "undefined" || !window.localStorage) {
    return crypto.randomUUID();
  }
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing && existing.length > 0) {
    return existing;
  }
  const created = crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, created);
  return created;
}
