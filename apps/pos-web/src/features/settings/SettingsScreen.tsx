"use client";

import {
  friendlyDeviceName,
  printerCapabilityLabel,
  scannerCapabilityLabel,
  toCashierError,
  TechnicalDetails,
} from "../../ui/cashier-language";

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
          <p>Small operational settings surface — not a WordPress-style control panel.</p>
        </div>
      </div>

      {state === "offline" ? (
        <div className="banner warning workspace-banner" role="status"><strong>Offline.</strong><span>Device settings remain readable. Changes that need confirmation should wait for connection.</span></div>
      ) : null}
      {state === "degraded" ? (
        <div className="banner warning workspace-banner" role="status"><strong>Some system information is temporarily unavailable.</strong><span>Open Store Health for current connection detail.</span></div>
      ) : null}
      {state === "error" ? (
        <div className="banner danger workspace-banner" role="alert">
          <strong>Settings could not be fully loaded.</strong><span>{errorMessage ? toCashierError({ message: errorMessage, domain: "generic" }).message : "Current device settings are shown where available."}</span>
          {onRetry ? <button className="btn small" type="button" onClick={onRetry}>Retry</button> : null}
        </div>
      ) : null}
      {state === "loading" ? (
        <div className="card card-pad workspace-state" role="status" aria-live="polite"><div className="workspace-spinner" aria-hidden="true" /><div><strong>Loading settings…</strong><p>Saved device settings are not being reset.</p></div></div>
      ) : null}
      {state === "empty" ? (
        <div className="card card-pad workspace-state" role="status"><div><strong>Settings are not available.</strong><p>Register settings will appear here when this device is assigned.</p></div></div>
      ) : null}

      {state !== "loading" && state !== "empty" ? (
        <div className="settings-grid">
          <section className="card card-pad stack" aria-labelledby="device-register-title">
            <h2 id="device-register-title">Device & register</h2>
            <div className="settings-value">
              <span className="label">Device</span>
              <strong>{friendlyDeviceName(settings.deviceName)}</strong>
            </div>
            <div className="settings-value">
              <span className="label">Register</span>
              <strong>{settings.registerName}</strong>
            </div>
            <div className="settings-value">
              <span className="label">Scanner</span>
              <span>{scannerCapabilityLabel(settings.scannerLabel)}</span>
            </div>
            <div className="settings-value">
              <span className="label">Printer</span>
              <span>{printerCapabilityLabel(settings.printerLabel)}</span>
            </div>
          </section>

          <section className="card card-pad stack settings-side" aria-labelledby="appearance-title">
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
            <h2 id="diagnostics-title">Diagnostics</h2>
            <div className="settings-value">
              <span className="label">Build</span>
              <strong>{settings.buildId}</strong>
            </div>
            <div className="settings-value">
              <span className="label">Frontend contracts</span>
              <span>{settings.contractVersion}</span>
            </div>
            {onOpenStoreHealth ? (
              <button className="btn block" type="button" onClick={onOpenStoreHealth}>
                Open Store Health
              </button>
            ) : null}
            <TechnicalDetails
              rows={[
                { label: "Build ID", value: settings.buildId },
                { label: "API contract", value: settings.contractVersion },
                ...(settings.localSchemaVersion ? [{ label: "Local schema", value: settings.localSchemaVersion }] : []),
                { label: "Device ID", value: settings.deviceName },
              ]}
            />
          </section>
        </div>
      ) : null}
    </section>
  );
}
