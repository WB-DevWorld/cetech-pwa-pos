"use client";

import { useState } from "react";
import type { ReceiptSettings } from "../../../../../docs/contracts/domain.generated";
import {
  RECEIPT_PRODUCT_NAME_MAX_CHARACTERS_MAX,
  RECEIPT_PRODUCT_NAME_MAX_CHARACTERS_MIN,
} from "../../core/receipt/settings";
import type { ManagementReceiptSettingsView } from "../../server/admin/handle-management-receipt-settings";

export type ReceiptLocationOption = {
  readonly id: string;
  readonly name: string;
};

export function parseReceiptNameMaxCharacters(value: string): number | "invalid" {
  const text = value.trim();
  if (!/^\d+$/.test(text)) return "invalid";
  const parsed = Number(text);
  if (
    !Number.isInteger(parsed) ||
    parsed < RECEIPT_PRODUCT_NAME_MAX_CHARACTERS_MIN ||
    parsed > RECEIPT_PRODUCT_NAME_MAX_CHARACTERS_MAX
  ) {
    return "invalid";
  }
  return parsed;
}

export function ReceiptSettingsPanel({
  locations,
  selectedLocationId,
  onSelectLocation,
  view,
  loading = false,
  saving = false,
  errorMessage,
  saveError,
  saveMessage,
  onSave,
}: {
  readonly locations: readonly ReceiptLocationOption[];
  readonly selectedLocationId?: string;
  readonly onSelectLocation?: (locationId: string) => void;
  readonly view: ManagementReceiptSettingsView | null;
  readonly loading?: boolean;
  readonly saving?: boolean;
  readonly errorMessage?: string;
  readonly saveError?: string;
  readonly saveMessage?: string;
  readonly onSave?: (settings: ReceiptSettings) => void;
}) {
  if (locations.length === 0 && !loading && !errorMessage) {
    return (
      <section className="card card-pad stack">
        <h2>Receipt settings</h2>
        <p role="status">No locations are available for receipt settings.</p>
      </section>
    );
  }
  if (loading || !view) {
    if (errorMessage) {
      return (
        <section className="card card-pad stack" aria-live="assertive">
          <div className="banner danger" role="alert">Receipt settings are temporarily unavailable.</div>
          <p>{errorMessage}</p>
        </section>
      );
    }
    return (
      <section className="card card-pad" aria-live="polite">
        <p>Loading receipt settings…</p>
      </section>
    );
  }

  const editorKey = [
    view.locationId,
    view.settings.shortenProductNames,
    view.settings.productNameMaxCharacters,
    view.settings.showSku,
    view.canManage,
  ].join(":");

  return (
    <div className="receipt-settings-panel stack" data-layout="receipt-settings">
      <LocationField
        locations={locations}
        selectedLocationId={selectedLocationId ?? view.locationId}
        onSelectLocation={onSelectLocation}
      />
      <ReceiptSettingsEditor
        key={editorKey}
        view={view}
        saving={saving}
        saveError={saveError}
        saveMessage={saveMessage}
        onSave={onSave}
      />
    </div>
  );
}

function LocationField({
  locations,
  selectedLocationId,
  onSelectLocation,
}: {
  readonly locations: readonly ReceiptLocationOption[];
  readonly selectedLocationId: string;
  readonly onSelectLocation?: (locationId: string) => void;
}) {
  const selected = locations.find((location) => location.id === selectedLocationId);
  if (locations.length <= 1) {
    return (
      <p>
        Location: <strong>{selected?.name ?? selectedLocationId}</strong>
      </p>
    );
  }
  return (
    <label className="field">
      <span>Location</span>
      <select
        className="select"
        value={selectedLocationId}
        onChange={(event) => onSelectLocation?.(event.target.value)}
      >
        {locations.map((location) => (
          <option key={location.id} value={location.id}>{location.name}</option>
        ))}
      </select>
    </label>
  );
}

function ReceiptSettingsEditor({
  view,
  saving = false,
  saveError,
  saveMessage,
  onSave,
}: {
  readonly view: ManagementReceiptSettingsView;
  readonly saving?: boolean;
  readonly saveError?: string;
  readonly saveMessage?: string;
  readonly onSave?: (settings: ReceiptSettings) => void;
}) {
  const [shortenProductNames, setShortenProductNames] = useState(view.settings.shortenProductNames);
  const [maxCharacters, setMaxCharacters] = useState(String(view.settings.productNameMaxCharacters));
  const [showSku, setShowSku] = useState(view.settings.showSku);
  const [localError, setLocalError] = useState<string | null>(null);
  const editable = view.canManage && !saving;

  function submit() {
    const parsed = parseReceiptNameMaxCharacters(maxCharacters);
    if (parsed === "invalid") {
      setLocalError("Enter a whole number from 1 to 256.");
      return;
    }
    setLocalError(null);
    onSave?.({
      shortenProductNames,
      productNameMaxCharacters: parsed,
      showSku,
    });
  }

  return (
    <section className="card card-pad stack">
      <div className="receipt-settings-head">
        <div>
          <h2>Receipt presentation</h2>
          <p className="muted">These choices change future receipts for this location. They do not change the product catalog.</p>
        </div>
        <span className="status-pill">{view.canManage ? "Editable" : "Read only"}</span>
      </div>
      {!view.canManage ? (
        <p role="status">Owner or Admin authority is required to change receipt settings.</p>
      ) : null}
      {saveError ? <div className="banner danger" role="alert">{saveError}</div> : null}
      {saveMessage ? <div className="banner success" role="status">{saveMessage}</div> : null}
      {localError ? <div className="banner danger" role="alert">{localError}</div> : null}

      <label className="receipt-settings-toggle">
        <span>
          <strong>Shorten product names on receipts</strong>
          <small>Limits how much of a product name is printed. Catalog names stay unchanged.</small>
        </span>
        <input
          type="checkbox"
          checked={shortenProductNames}
          disabled={!editable}
          onChange={(event) => setShortenProductNames(event.target.checked)}
        />
      </label>

      <label className="field">
        <span>Maximum product-name characters</span>
        <input
          className="input"
          inputMode="numeric"
          value={maxCharacters}
          disabled={!editable}
          aria-describedby="receipt-name-max-help"
          onChange={(event) => setMaxCharacters(event.target.value)}
        />
        <small id="receipt-name-max-help">Use a whole number from 1 to 256.</small>
      </label>

      <label className="receipt-settings-toggle">
        <span>
          <strong>Show SKU on receipts</strong>
          <small>Prints a SKU when the receipt line has one. Lines without a SKU stay blank.</small>
        </span>
        <input
          type="checkbox"
          checked={showSku}
          disabled={!editable}
          onChange={(event) => setShowSku(event.target.checked)}
        />
      </label>

      {view.canManage ? (
        <button className="btn" type="button" disabled={saving} onClick={submit}>
          {saving ? "Saving…" : "Save receipt settings"}
        </button>
      ) : null}
    </section>
  );
}
