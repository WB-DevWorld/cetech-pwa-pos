/**
 * Issue #24 allowed sales-test path. Canonical executable suite lives at
 * apps/pos-web/src/server/sales/cash-finalize-orchestration.test.ts so the
 * required `pnpm --dir apps/pos-web test` command discovers it without editing
 * shared vitest.config.mts.
 */
import "../../../apps/pos-web/src/server/sales/cash-finalize-orchestration.test";
