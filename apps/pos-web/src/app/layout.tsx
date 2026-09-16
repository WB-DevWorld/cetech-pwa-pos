import "@/ui/tokens.css";
import "@/ui/shell/shell.css";
import "@/features/sell/sell.css";
import "@/features/returns/returns.css";
import "@/features/register/register.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "CETECH POS",
  description: "CETECH POS cashier workspace. Not a production payment terminal.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
