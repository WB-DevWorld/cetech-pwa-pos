Canonical CORE-03 BFF health tests. Discovered by `pnpm --dir apps/pos-web test` via `apps/pos-web/vitest.config.mts`.

- Default `GET /health` stays unattached unless a non-placeholder server-only bridge identity exists.
- Adapter tests inject `fetchImpl` against the frozen BridgeHealth envelope (BR-01 example shape). They do not call a live host.
- Request `X-Correlation-ID` must be echoed; mismatch/malformed/missing correlation is not trusted.
- Detection is not pricing parity. `pricingParityVerified` stays false.
- Live WordPress install, Application Password provisioning, and Woo writes remain CP-04-gated.
