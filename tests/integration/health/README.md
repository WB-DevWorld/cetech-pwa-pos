Canonical CORE-03 BFF health tests. Discovered by `pnpm --dir apps/pos-web test` via `apps/pos-web/vitest.config.mts`.

- Default `GET /health` path is still PREP_ONLY (skipped probes; no live WordPress).
- Adapter tests inject `fetchImpl` against the frozen BridgeHealth envelope (BR-01 example shape). They do not call a live host.
- Detection is not pricing parity. `pricingParityVerified` stays false.
