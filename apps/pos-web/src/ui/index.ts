export {
  AppShell,
  POS_ROUTE_HREFS,
  POS_ROUTES,
  PRIMARY_NAV_ITEMS,
  SETTINGS_NAV_ITEM,
  SHELL_STYLESHEETS,
  type AppShellProps,
  type PosRoute,
} from "./shell";
export {
  ConnectivityNotice,
  FixAppPanel,
  LocalDataMigrationPanel,
  NeedsAttentionScreen,
  OPERATIONAL_STYLESHEETS,
  PassiveTabNotice,
  StoreHealthScreen,
  UpdateReadyDialog,
  type AttentionItemView,
  type AttentionSeverityView,
  type FixAppPanelProps,
  type LocalDataMigrationPanelProps,
  type MigrationStateView,
  type NeedsAttentionScreenProps,
  type OperationalLoadState,
  type StoreHealthScreenProps,
  type UpdateReadyDialogProps,
  type UpdateSafetyView,
} from "./operational";
export {
  TechnicalDetails,
  catalogRebuildCopy,
  describePaymentState,
  describeQuoteFailure,
  toCashierError,
  type CashierErrorView,
} from "./cashier-language";

export const WORKSPACE_STYLESHEETS = ["@/ui/workspace.css"] as const;
