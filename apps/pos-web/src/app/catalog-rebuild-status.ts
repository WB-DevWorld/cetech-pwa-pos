import type { CatalogProjectionAvailability } from "../local/catalog-sync";

export type CatalogRebuildView =
  | { readonly phase: "idle" }
  | { readonly phase: "rebuilding" }
  | { readonly phase: "success"; readonly itemCount: number; readonly availability: CatalogProjectionAvailability }
  | { readonly phase: "failure"; readonly message: string };

export function catalogRebuildStatusText(view: CatalogRebuildView): string | undefined {
  if (view.phase === "rebuilding") {
    return "Rebuilding catalog…";
  }
  if (view.phase === "success") {
    return `Catalog refreshed. ${view.itemCount} items. Availability ${view.availability}.`;
  }
  if (view.phase === "failure") {
    return `Catalog rebuild failed. ${view.message} Retry Rebuild Catalog without clearing carts or journal.`;
  }
  return undefined;
}
