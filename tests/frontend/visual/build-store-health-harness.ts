import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppShell } from "../../../apps/pos-web/src/ui/shell/AppShell";
import { StoreHealthScreen } from "../../../apps/pos-web/src/features/health/StoreHealthScreen";
import {
  deriveOverallSeverity,
  type StoreHealthSessionView,
} from "../../../apps/pos-web/src/features/health/storeHealthView";
import { findRepoRoot } from "./build-harness";

function css(relative: string): string {
  return readFileSync(resolve(findRepoRoot(), relative), "utf8");
}

function documentFor(title: string, body: string): string {
  const styles = [
    css("apps/pos-web/src/ui/tokens.css"),
    css("apps/pos-web/src/ui/shell/shell.css"),
    css("apps/pos-web/src/features/health/health.css"),
  ].join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>${styles}</style>
</head>
<body>${body}</body>
</html>`;
}

function session(): StoreHealthSessionView {
  const next: StoreHealthSessionView = {
    stage: "ready",
    connectivity: "online",
    leadership: "active",
    updateReady: true,
    activation: { safe: false, reasons: ["ACTIVE_TENDER"] },
    activating: false,
    checkingUpdate: false,
    health: {
      contractVersion: "1.0.0",
      pendingOperationCount: 1,
      attentionCount: 1,
      buildId: "1.2.0",
      checks: [
        {
          id: "commerce",
          status: "healthy",
          message: "Commerce is available.",
          checkedAt: "2026-09-16T10:00:00.000Z",
        },
        {
          id: "catalog",
          status: "unverified",
          message: "Catalog freshness is unverified.",
          checkedAt: "2026-09-16T10:00:00.000Z",
        },
      ],
    },
    recovery: {
      localSchema: 4,
      expectedSchema: 4,
      schemaCompatible: true,
      cartDraftCount: 2,
      pendingOperationCount: 1,
      attentionOperationCount: 1,
      rebuildableCatalogItemCount: 8,
      destructiveResetAllowed: false,
      recommendedActions: ["RESOLVE_PENDING_OPERATIONS", "REVIEW_ATTENTION_OPERATIONS"],
    },
    releasePolicy: {
      latestBuild: "1.3.0",
      recommendedBuild: "1.2.0",
      minimumSupportedBuild: "1.0.0",
      minimumApiVersion: "1.0.0",
      minimumLocalSchema: 4,
    },
    unknownOperationPresent: true,
    message: "Store health loaded from the server.",
    overallSeverity: "blocking",
  };
  return { ...next, overallSeverity: deriveOverallSeverity(next) };
}

export function buildStoreHealthHarnessHtml(): string {
  const body = renderToStaticMarkup(
    createElement(AppShell, {
      activeRoute: "health",
      registerName: "Front Counter 1",
      cashierDisplayName: "Staff member",
      shiftOpen: true,
      online: true,
      attentionCount: 1,
      children: createElement(StoreHealthScreen, {
        session: session(),
        inFlight: false,
        onRefresh: () => undefined,
        onCheckForUpdate: () => undefined,
        onActivateWaitingUpdate: () => undefined,
      }),
    }),
  );
  return documentFor("CETECH POS store health", body);
}

export function repoHasHealthCss(): boolean {
  return existsSync(resolve(findRepoRoot(), "apps/pos-web/src/features/health/health.css"));
}
