"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { FOCUSABLE_SELECTOR, nextFocusIndex } from "../state/modalFocus";

export function SellModal({
  titleId,
  onClose,
  children,
  showClose = false,
  closeLabel = "Close",
  closeDisabled = false,
  size = "default",
  focusKey,
}: {
  titleId: string;
  onClose: () => void;
  children: ReactNode;
  showClose?: boolean;
  closeLabel?: string;
  closeDisabled?: boolean;
  size?: "default" | "payment";
  focusKey?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || typeof document === "undefined") return;
    const root: HTMLElement = dialog;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    function focusables(): HTMLElement[] {
      return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => !element.hasAttribute("disabled"),
      );
    }

    const heading = root.querySelector<HTMLElement>(`#${titleId}`);
    const primary = root.querySelector<HTMLElement>("[data-autofocus-primary]");
    (primary ?? heading ?? focusables()[0])?.focus({ preventScroll: true });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (!closeDisabled) {
          onClose();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);
      const next = nextFocusIndex(items.length, currentIndex, event.shiftKey);
      event.preventDefault();
      event.stopPropagation();
      items[next]?.focus();
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previous?.focus();
    };
  }, [closeDisabled, focusKey, onClose, titleId]);

  return (
    <dialog
      ref={dialogRef}
      className={`sell-dialog${size === "payment" ? " payment-dialog" : ""}`}
      open
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {showClose ? (
        <button
          type="button"
          className="dialog-close"
          onClick={onClose}
          disabled={closeDisabled}
          aria-label={closeLabel}
        >
          ×
        </button>
      ) : null}
      {children}
    </dialog>
  );
}
