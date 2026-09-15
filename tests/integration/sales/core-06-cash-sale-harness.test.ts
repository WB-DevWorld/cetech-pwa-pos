/**
 * Issue #25 allowed integration-test path. Canonical executable suite:
 * apps/pos-web/src/server/sales/core-06-cash-sale-harness.test.ts
 * so `pnpm --dir apps/pos-web test` discovers it without double-running.
 */
import "../../../apps/pos-web/src/server/sales/core-06-cash-sale-harness.test";
