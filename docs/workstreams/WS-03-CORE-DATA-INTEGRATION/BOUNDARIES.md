# WS3 boundaries

| Category | Exact scope |
| --- | --- |
| OWN | apps/pos-web/src/core/**; apps/pos-web/src/server/**; apps/pos-web/src/config/**; apps/pos-web/src/app/**; apps/pos-web/src/local/**; apps/pos-web/public/**; supabase/**; docs/**; scripts/**; .github/**; .cursor/**; root control/config; tests/integration/**; tests/contracts/**; tests/e2e/**; this workstream STATUS/HANDOFF/evidence |
| MAY MODIFY WITH APPROVAL | Explicit path/branch/editor/time delegation from WS3 in CURRENT-WORK.md; relevant shared contracts through WS3 coordinated change |
| MUST NOT MODIFY | WS1 feature/UI files and WS2 plugin implementation except an explicitly recorded integration delegation; source artifact bytes |
| CONSUMES | Current ADRs, canonical schema/ports, normalized bridge responses, payment verification, frontend feature contracts, verified live environment facts. |
| PRODUCES | Frozen contracts, BFF/auth/use cases, operational schema/RLS, Dexie/update coordination, CI, integration evidence and release qualification. |

Resolve paths beginning src/ or public/ relative to apps/pos-web. No private agent instruction overrides these paths. If a required edit crosses the boundary, propose the exact change and let its owner merge it first.
