"use client";

import dynamic from "next/dynamic";

const InviteAcceptance = dynamic(
  () => import("./InviteAcceptance").then((mod) => mod.InviteAcceptance),
  { ssr: false },
);

export function InviteAcceptanceLoader({
  supabaseUrl,
  publishableKey,
}: {
  readonly supabaseUrl: string | null;
  readonly publishableKey: string | null;
}) {
  return <InviteAcceptance supabaseUrl={supabaseUrl} publishableKey={publishableKey} />;
}
