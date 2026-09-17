"use client";

export type SettingsWorkspaceState = "ready" | "loading" | "empty" | "offline" | "degraded" | "error";
export type AppearancePreference = "system" | "light" | "dark";

export interface PosSettingsView {
  readonly deviceName: string;
  readonly registerName: string;
  readonly scannerLabel: string;
  readonly printerLabel: string;
  readonly appearance: AppearancePreference;
  readonly buildId: string;
  readonly contractVersion: string;
  readonly localSchemaVersion?: string;
}

export interface SettingsScreenProps {
  readonly settings: PosSettingsView;
  readonly state?: SettingsWorkspaceState;
  readonly errorMessage?: string;
  readonly onAppearanceChange?: (appearance: AppearancePreference) => void;
  readonly onOpenStoreHealth?: () => void;
  readonly onRetry?: () => void;
}

export function SettingsScreen({
  settings,
  state = "ready",
  errorMessage,
  onAppearanceChange,
  onOpenStoreHealth,
  onRetry,
}: SettingsScreenProps) {
  return (
    <section className="settings-workspace workspace-surface" aria-labelledby="settings-title">
      <div className="page-head">
        <div>
          <h1 id="settings-title">Settings</h1>
          <p>Small operational settings surface — not a provider control panel.</p>
        </div>
      </div>

      {state === "offline" ? (
        <div className="banner warning workspace-banner" role="status"><strong>Offline.</strong><span>Device settings remain readable. Changes that need server confirmation should wait for connection.</span></div>
      ) : null}
      {state === "degraded" ? (
        <div className="banner warning workspace-banner" role="status"><strong>Some diagnostics are degraded.</strong><span>Open Store Health for current service-level detail.</span></div>
      ) : null}
      {state === "error" ? (
        <div className="banner danger workspace-banner" role="alert">
          <strong>Settings could not be fully loaded.</strong><span>{errorMessage ?? "Current device settings are shown where available."}</span>
          {onRetry ? <button className="btn small" type="button" onClick={onRetry}>Retry</button> : null}
        </div>
      ) : null}
      {state === "loading" ? (
        <div className="card card-pad workspace-state" role="status" aria-live="polite"><div className="workspace-spinner" aria-hidden="true" /><div><strong>Loading settings…</strong><p>Local device state is not being reset.</p></div></div>
      ) : null}
      {state === "empty" ? (
        <div className="card card-pad workspace-state" role="status"><div><strong>Settings are not available.</strong><p>WS3 must mount the current device/register settings source before operational changes are offered.</p></div></div>
      ) : null}

      {state !== "loading" && state !== "empty" ? <div className="settings-grid">
        <section className="card card-pad stack" aria-labelledby="device-register-title">
          <h2 id="device-register-title">Device & register</h2>
          <div className="settings-value"><span className="label">Device</span><strong>{settings.deviceName}</strong></div>
          <div className="settings-value"><span className="label">Register</span><strong>{settings.registerName}</strong></div>
          <div className="settings-value"><span className="label">Scanner</span><span>{settings.scannerLabel}</span></div>
          <div className="settings-value"><span className="label">Printer</span><span>{settings.printerLabel}</span></div>
        </section>

        <section className="card card-pad stack" aria-labelledby="appearance-title">
          <h2 id="appearance-title">Appearance</h2>
          <label className="field" htmlFor="appearance-select">
            <span>Theme</span>
            <select
              id="appearance-select"
              className="select"
              value={settings.appearance}
              disabled={!onAppearanceChange}
              onChange={(event) => onAppearanceChange?.(event.target.value as AppearancePreference)}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <div className="settings-divider" />
          <h2>Diagnostics</h2>
          <div className="settings-value"><span className="label">Build</span><strong>{settings.buildId}</strong></div>
          <div className="settings-value"><span className="label">API contract</span><strong>{settings.contractVersion}</strong></div>
          {settings.localSchemaVersion ? <div className="settings-value"><span className="label">Local schema</span><strong>{settings.localSchemaVersion}</strong></div> : null}
          {onOpenStoreHealth ? <button className="btn" type="button" onClick={onOpenStoreHealth}>Open Store Health</button> : null}
        </section>
      </div> : null}
    </section>
  );
}
