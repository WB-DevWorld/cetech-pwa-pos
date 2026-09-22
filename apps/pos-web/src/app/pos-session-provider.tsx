"use client";

import type { ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { PosApp } from "./pos-app";
import { posRouteFromPathname } from "./pos-route";

export function PosSessionProvider({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const route = posRouteFromPathname(pathname);
  const initialReturnSaleId = route === "returns" ? searchParams.get("sale") : null;
  return (
    <>
      {route ? <PosApp route={route} initialReturnSaleId={initialReturnSaleId} /> : null}
      {children}
    </>
  );
}
