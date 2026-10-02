const STORAGE_KEY = "cetech_pos_device_id";

/**
 * Returns the last server-owned device selected for this browser, if any.
 * The stored value is only a preference; the server remains authoritative and
 * every use must be re-validated against the selected register/location.
 */
export function readLocalDeviceId(): string | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  const value = window.localStorage.getItem(STORAGE_KEY)?.trim();
  return value ? value : null;
}

export function rememberLocalDeviceId(deviceId: string): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  const value = deviceId.trim();
  if (value) {
    window.localStorage.setItem(STORAGE_KEY, value);
  }
}

/**
 * Legacy compatibility helper. New operational flows must resolve a
 * server-owned device first rather than inventing a browser UUID.
 */
export function readOrCreateLocalDeviceId(): string {
  return readLocalDeviceId() ?? "";
}
