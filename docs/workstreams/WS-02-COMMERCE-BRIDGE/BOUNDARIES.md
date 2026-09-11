# WS2 boundaries

| Category | Exact scope |
| --- | --- |
| OWN | wordpress/cetech-pos-bridge/**; tests/bridge/**; tests/fixtures/commerce/**; this workstream STATUS/HANDOFF/evidence |
| MAY MODIFY WITH APPROVAL | Explicit path/branch/editor/time delegation from WS3 in CURRENT-WORK.md; relevant shared contracts through WS3 coordinated change |
| MUST NOT MODIFY | apps/**; supabase/**; docs/contracts/**; .github/**; root config/lockfiles; reference/** |
| CONSUMES | bridge-api.openapi.json, QuoteRequest/Quote, PrepareSaleRequest, BridgeFinalizeRequest, error-policy.json, actual staging plugin configuration. |
| PRODUCES | Independently buildable WordPress plugin; normalized commerce responses; redacted golden pricing corpus and parity results; HPOS/idempotency tests. |

Resolve paths beginning src/ or public/ relative to apps/pos-web. No private agent instruction overrides these paths. If a required edit crosses the boundary, propose the exact change and let its owner merge it first.
