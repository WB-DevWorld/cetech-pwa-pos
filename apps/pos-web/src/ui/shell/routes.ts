export const POS_ROUTES = [
  "sell",
  "orders",
  "customers",
  "returns",
  "register",
  "health",
  "attention",
  "settings",
] as const;

export type PosRoute = (typeof POS_ROUTES)[number];

/** Planned WS3 App Router hrefs. FE-02 does not own `src/app` routes. */
export const POS_ROUTE_HREFS: Record<PosRoute, string> = {
  sell: "/sell",
  orders: "/orders",
  customers: "/customers",
  returns: "/returns",
  register: "/register",
  health: "/health",
  attention: "/attention",
  settings: "/settings",
};

export type NavItem = {
  readonly route: PosRoute;
  readonly label: string;
  readonly icon: string;
};

export const PRIMARY_NAV_ITEMS: readonly NavItem[] = [
  { route: "sell", label: "Sell", icon: "▦" },
  { route: "orders", label: "Orders", icon: "▤" },
  { route: "customers", label: "Customers", icon: "♙" },
  { route: "returns", label: "Returns", icon: "↩" },
  { route: "register", label: "Register", icon: "▣" },
  { route: "health", label: "System status", icon: "●" },
  { route: "attention", label: "Attention", icon: "!" },
];

export const SETTINGS_NAV_ITEM: NavItem = {
  route: "settings",
  label: "Settings",
  icon: "⚙",
};
