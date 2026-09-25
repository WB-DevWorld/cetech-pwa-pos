"use client";

import { LoginScreen, type AuthNoticeState } from "../features/auth";
import type { StaffSignInRequest } from "../core/identity";
import { toCashierError } from "../ui/cashier-language";

export function StaffAuthGate({
  noticeState,
  busy,
  errorMessage,
  onSignIn,
}: {
  readonly noticeState: AuthNoticeState;
  readonly busy: boolean;
  readonly errorMessage?: string;
  readonly onSignIn: (request: StaffSignInRequest) => void;
}) {
  return (
    <div className="staff-auth-gate">
      <LoginScreen
        noticeState={noticeState}
        busy={busy}
        errorMessage={
          errorMessage
            ? toCashierError({ message: errorMessage, domain: "auth" }).message
            : undefined
        }
        onSignIn={onSignIn}
      />
    </div>
  );
}
