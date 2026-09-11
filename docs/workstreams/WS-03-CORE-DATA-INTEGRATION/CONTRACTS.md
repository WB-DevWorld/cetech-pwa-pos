# WS3 contracts

Version: 1.0.0. Contract owner: WS3 / senior. Consumes: Current ADRs, canonical schema/ports, normalized bridge responses, payment verification, frontend feature contracts, verified live environment facts.

Produces: Frozen contracts, BFF/auth/use cases, operational schema/RLS, Dexie/update coordination, CI, integration evidence and release qualification. The canonical payload authority is ../../contracts/pos-domain.schema.json; generated types and ports live beside it. Do not redefine them locally. WS3 coordinates all canonical contract production and consumer review.

Mocks are synthetic and schema-conformant; include expired quote, revision races, pending payment, post-payment finalization failure and typed authorization/integration errors. They cannot serve as real pricing parity evidence. WS2's golden corpus records live staging totals, version/configuration and applicability.

Changes: issue → architecture guardian → WS3 decision/ADR → schema/types/OpenAPI/fixtures together → WS1/WS2 consumer review → merge before dependent code. No P0 InventoryPort; ReceiptPort and PrintPort remain separate; only server orchestrates verified tender into SalesPort.confirmPayment.
