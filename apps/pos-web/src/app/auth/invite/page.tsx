import { readPublicStaffAuthEnv } from "../../../config/env";
import { InviteAcceptanceLoader } from "../../../features/auth/InviteAcceptanceLoader";

export default function InviteAcceptancePage() {
  const auth = readPublicStaffAuthEnv();
  return (
    <InviteAcceptanceLoader supabaseUrl={auth?.url ?? null} publishableKey={auth?.publishableKey ?? null} />
  );
}
