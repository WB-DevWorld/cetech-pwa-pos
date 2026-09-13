import { SERVER_ONLY_CONFIG_NAMES, SERVER_ONLY_SECRET_NAMES } from "../config/secrets";

const EXTRA_FORBIDDEN = ["BEGIN PRIVATE KEY", "PRIVATE KEY-----", "SUPABASE_SERVICE_ROLE"] as const;

export function journalPayloadContainsSecrets(payload: string): boolean {
  const upper = payload.toUpperCase();
  for (const name of SERVER_ONLY_SECRET_NAMES) {
    if (upper.includes(name.toUpperCase())) {
      return true;
    }
  }
  for (const name of SERVER_ONLY_CONFIG_NAMES) {
    if (upper.includes(name.toUpperCase())) {
      return true;
    }
  }
  return EXTRA_FORBIDDEN.some((token) => upper.includes(token));
}

export function assertJournalPayloadHasNoSecrets(payload: string): void {
  if (journalPayloadContainsSecrets(payload)) {
    throw new Error("operation journal payload must not contain privileged secrets");
  }
}
