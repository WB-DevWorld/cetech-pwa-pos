import { isUuid } from "../auth/ids";
import type { Uuid } from "../../../../../docs/contracts/domain.generated";

export function resolveCorrelationId(header: string | undefined): {
  readonly ok: true;
  readonly correlationId: Uuid;
} | {
  readonly ok: false;
  readonly correlationId: Uuid;
} {
  const inbound = header?.trim().toLowerCase();
  if (inbound && isUuid(inbound)) {
    return { ok: true, correlationId: inbound };
  }
  return { ok: false, correlationId: crypto.randomUUID() };
}
