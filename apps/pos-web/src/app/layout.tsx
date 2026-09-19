import "@/ui/tokens.css";
import "@/ui/shell/shell.css";
import "@/ui/workspace.css";
import "@/ui/operational/operational.css";
import "@/ui/toast/toast.css";
import "@/features/sell/sell.css";
import "@/features/returns/returns.css";
import "@/features/register/register.css";
import "@/features/auth/auth.css";
import "@/features/orders/orders.css";
import "@/features/customers/customers.css";
import "@/features/settings/settings.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { readServerEnv } from "../config/env";
import { readReleasePolicy } from "../config/release-policy";
import { PosSessionProvider } from "./pos-session-provider";
import { PwaLifecycleRuntime } from "./pwa-lifecycle-runtime";
import "./globals.css";

export const metadata: Metadata = {
  title: "CETECH POS",
  description: "CETECH POS cashier workspace. Not a production payment terminal.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const env = readServerEnv();
  const initialReleasePolicy = readReleasePolicy(process.env, env.buildId);
  return (
    <html lang="en">
      <body>
        <PwaLifecycleRuntime appBuild={env.buildId} initialReleasePolicy={initialReleasePolicy}>
          <PosSessionProvider>{children}</PosSessionProvider>
        </PwaLifecycleRuntime>
      </body>
    </html>
  );
}
