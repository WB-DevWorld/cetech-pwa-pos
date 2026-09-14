import { createMemoryAssignmentDirectory, type StaffAssignmentDirectory } from "../auth/assignments";

let processDirectory: StaffAssignmentDirectory | undefined;

export function assertEphemeralAssignmentDirectoryAllowed(
  env: Readonly<Record<string, string | undefined>> = process.env,
): void {
  const appEnv = env.APP_ENV ?? "local";
  if (appEnv === "production" || appEnv === "staging") {
    throw new Error("ephemeral in-memory assignment directory is not a durable production runtime");
  }
}

/**
 * Local/dev fail-closed assignment directory until a durable CORE-02 adapter exists.
 * Tests inject `createMemoryAssignmentDirectory`. Staging/production must not select this.
 */
export function composeStaffAssignmentDirectory(
  env: Readonly<Record<string, string | undefined>> = process.env,
): StaffAssignmentDirectory {
  assertEphemeralAssignmentDirectoryAllowed(env);
  processDirectory ??= createMemoryAssignmentDirectory([]);
  return processDirectory;
}
