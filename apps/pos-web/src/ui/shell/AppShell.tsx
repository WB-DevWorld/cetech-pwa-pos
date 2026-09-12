"use client";

import type { ReactNode } from "react";
import { PrimaryNav } from "./PrimaryNav";
import { SETTINGS_NAV_ITEM, POS_ROUTE_HREFS, type PosRoute } from "./routes";
import { TopBar, type TopBarProps } from "./TopBar";

export type AppShellProps = TopBarProps & {
  activeRoute: PosRoute;
  attentionCount?: number;
  onNavigate?: (route: PosRoute) => void;
  liveMessage?: string;
  children: ReactNode;
};

export function AppShell({
  activeRoute,
  attentionCount = 0,
  onNavigate,
  liveMessage,
  children,
  ...topBar
}: AppShellProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className="live-region" aria-live="polite">
        {liveMessage ?? ""}
      </div>
      <aside className="sidebar" aria-label="App sidebar">
        <div className="brand-mark" title="CETECH">
          CT
        </div>
        <PrimaryNav
          activeRoute={activeRoute}
          attentionCount={attentionCount}
          onNavigate={onNavigate}
        />
        <div className="sidebar-bottom">
          <button
            type="button"
            className={activeRoute === "settings" ? "nav-btn active" : "nav-btn"}
            aria-current={activeRoute === "settings" ? "page" : undefined}
            aria-label="Settings"
            data-route="settings"
            data-href={POS_ROUTE_HREFS.settings}
            onClick={() => onNavigate?.(SETTINGS_NAV_ITEM.route)}
          >
            <span className="icon" aria-hidden="true">
              {SETTINGS_NAV_ITEM.icon}
            </span>
            <span>{SETTINGS_NAV_ITEM.label}</span>
          </button>
        </div>
      </aside>
      <div className="app-main">
        <TopBar {...topBar} />
        <main className="content" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
