"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PosApp } from "./pos-app";
import { posRouteFromPathname } from "./pos-route";

export function PosSessionProvider({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  const route = posRouteFromPathname(pathname);
  return (
    <>
      {route ? <PosApp route={route} /> : null}
      {children}
    </>
  );
}
