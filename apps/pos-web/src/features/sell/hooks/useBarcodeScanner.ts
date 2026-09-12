"use client";

import { useEffect } from "react";
import { appendBarcodeKey, createBarcodeBuffer, shouldCaptureBarcodeKey } from "../state/barcodeBuffer";

export function useBarcodeScanner(onScan: (barcode: string) => void, enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let buffer = createBarcodeBuffer();
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "F2" || event.key === "F4" || event.key === "F8" || event.key === "Escape") return;
      const target = event.target as HTMLElement | null;
      if (!shouldCaptureBarcodeKey(target)) return;
      const next = appendBarcodeKey(buffer, event.key, Date.now());
      buffer = next.state;
      if (next.barcode) {
        event.preventDefault();
        onScan(next.barcode);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, onScan]);
}
