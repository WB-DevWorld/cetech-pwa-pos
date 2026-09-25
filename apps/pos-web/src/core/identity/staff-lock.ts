import type { StaffRuntimeController } from "./staff-runtime";

/**
 * Explicit lock/sign-out composition.
 * Local runtime retirement runs before the identity port's remote session
 * clear, so a rejected remote call cannot skip offline-presentation removal.
 */
export async function lockStaffSession(input: {
  readonly identity: { signOut(): Promise<void> };
  readonly runtime: StaffRuntimeController;
}): Promise<void> {
  await input.runtime.signOut();
  try {
    await input.identity.signOut();
  } catch {
    input.runtime.reportUnconfirmedRemoteSignOut();
  }
}
