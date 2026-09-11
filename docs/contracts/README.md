# Frozen shared contracts v1.0.0

Design freeze: 2026-09-11 under the current bootstrap authorization. Implementations and live parity are not yet verified. Owner: WS3. Three workstreams consume this same version.

- pos-domain.schema.json is the machine-readable payload authority (JSON Schema 2020-12).
- domain.generated.ts is derived with `python3 scripts/generate_contract_types.py`; do not edit it.
- ports.ts defines application responsibilities and returns the common ApiResult. Implementations map wire failures to these explicit results.
- pos-api.openapi.json defines BFF `/api/pos/v1`; bridge-api.openapi.json defines private server-to-server `/wp-json/cetech-pos/v1`. Both reference the same payload schemas.
- DOMAIN-CONTRACTS.md defines semantic invariants beyond structural schema validation.
- SALE-STATE-MACHINE.json defines permitted state transitions and guards.
- API-CONVENTIONS.md / ERROR-CONTRACT.md define one wire policy.

No standalone P0 InventoryPort. No UI authority for sale finalization. No print effect on ReceiptPort. Quantity strings and opaque provider mappings intentionally correct prototype shortcuts; see PROTOTYPE-MAPPING.md.

M1 contracts are frozen. M2 ReturnPort shapes are also defined, but refund authorization, provider refund adapter and bridge commercial refund/restock wire endpoints require RT-01's refinement before execution. No unrestricted backend implementation based on an undefined endpoint.

Foundation validation checks generated artifacts, schema references and selected examples. It does not implement a full JSON Schema validator or prove runtime correctness. CP-05/CORE-06 must add a maintained runtime validator and contract test runner with pinned dependencies.
