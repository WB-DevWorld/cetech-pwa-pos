import { catalogRebuildCopy } from "../ui/cashier-language";
import type { CatalogProjectionAvailability } from "../local/catalog-sync";

export type CatalogRebuildView =
  | { readonly phase: "idle" }
  | { readonly phase: "rebuilding" }
  | { readonly phase: "success"; readonly itemCount: number; readonly availability: CatalogProjectionAvailability }
  | { readonly phase: "failure"; readonly message: string };

export function catalogRebuildStatusText(view: CatalogRebuildView): string | undefined {
  return catalogRebuildCopy({
    phase: view.phase,
    itemCount: view.phase === "success" ? view.itemCount : undefined,
    message: view.phase === "failure" ? view.message : undefined,
  });
}
