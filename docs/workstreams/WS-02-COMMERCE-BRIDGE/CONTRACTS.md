# WS2 contracts

Version: 1.0.0. Contract owner: WS3 / senior. Consumes: bridge-api.openapi.json, QuoteRequest/Quote, PrepareSaleRequest, BridgeFinalizeRequest, error-policy.json, actual staging plugin configuration.

Produces: Independently buildable WordPress plugin; normalized commerce responses; redacted golden pricing corpus and parity results; HPOS/idempotency tests. The canonical payload authority is ../../contracts/pos-domain.schema.json; generated types and ports live beside it. Do not redefine them locally. This workstream implements/consumes responses, not independent contract shapes.

Mocks are synthetic and schema-conformant; include expired quote, revision races, pending payment, post-payment finalization failure and typed authorization/integration errors. They cannot serve as real pricing parity evidence. WS2's golden corpus records live staging totals, version/configuration and applicability.

Changes: issue → architecture guardian → WS3 decision/ADR → schema/types/OpenAPI/fixtures together → WS1/WS2 consumer review → merge before dependent code. No P0 InventoryPort; ReceiptPort and PrintPort remain separate; only server orchestrates verified tender into SalesPort.confirmPayment.
