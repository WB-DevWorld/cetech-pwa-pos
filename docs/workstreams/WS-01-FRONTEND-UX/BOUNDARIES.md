# WS1 boundaries

| Category | Exact scope |
| --- | --- |
| OWN | apps/pos-web/src/features/**; apps/pos-web/src/ui/**; tests/frontend/**; this workstream STATUS/HANDOFF/evidence |
| MAY MODIFY WITH APPROVAL | Explicit path/branch/editor/time delegation from WS3 in CURRENT-WORK.md; relevant shared contracts through WS3 coordinated change |
| MUST NOT MODIFY | src/core/**; src/server/**; src/local/**; src/config/**; src/app/**; public/**; wordpress/**; supabase/**; root package/lockfiles; docs/contracts/**; .github/**; reference/** |
| CONSUMES | CatalogPort, CustomerPort, PricingPort, CheckoutUseCases, PaymentPort UI-safe methods, RegisterPort, ReceiptPort, PrintPort, IdentityPort, HealthPort; QuoteState and CheckoutEligibility. |
| PRODUCES | Feature components, semantic tokens, responsive flows, port-driven view models and frontend regression evidence. |

Resolve paths beginning src/ or public/ relative to apps/pos-web. No private agent instruction overrides these paths. If a required edit crosses the boundary, propose the exact change and let its owner merge it first.
