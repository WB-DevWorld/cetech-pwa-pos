export { AppShell, type AppShellProps } from "./AppShell";
export { PrimaryNav, type PrimaryNavProps } from "./PrimaryNav";
export { TopBar, type TopBarProps } from "./TopBar";
export {
  POS_ROUTE_HREFS,
  POS_ROUTES,
  PRIMARY_NAV_ITEMS,
  SETTINGS_NAV_ITEM,
  type NavItem,
  type PosRoute,
} from "./routes";

/** Stylesheets WS3 should import from `src/app` layout. FE-02 does not own route files. */
export const SHELL_STYLESHEETS = [
  "@/ui/tokens.css",
  "@/ui/shell/shell.css",
] as const;
