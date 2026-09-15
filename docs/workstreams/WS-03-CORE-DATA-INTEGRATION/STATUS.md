# WS3 current status

Snapshot 2026-09-15. RT-01 / #27 combined safe-returns integration on `batch/rt01-safe-returns-ws3-integrated`.

## Current truth

| Role | SHA / classification |
| --- | --- |
| Post-R6 `main` | `bd79c2901ce33c3177141d4244cc196be0a719d2` ACCEPTED / MERGED |
| PAY-01 / R7 code-ready head | `9ab7e5b7cf2b5d4f253f9d41468726c31cbfc091` PROVISIONAL_TEST / sandbox-deferred |
| Accepted RT-01 contract | `58d385300bfba784435448029e88f07742048cde` |
| Accepted WS3 RT-01 runtime | `4650a0fa18c909743e9fbab4be0b6067bd1eff18` |
| Accepted BR-08 / WS2 source | `dcf9098a331f878647e067fc78b3c05778f8f668` |
| Accepted FE-06 / WS1 source | `0ddde7c727337c4005e9878071817bbf826d41a2` |
| Combined RT-01 receiver | `d54a916946a6dcf0dfbc636d93528ac58a77ca1b` |

R7 PR #58 remains draft / sandbox-deferred / NOT MERGED. Issue #4 remains OPEN. `pricingParityVerified=false`. Production promotion is NOT AUTHORIZED.

## RT-01 combined integration

ADR-015 is accepted and frozen. The three owner lanes are now combined without transferring implementation ownership:

- WS3: return preview/orchestration/storage/reconciliation runtime.
- WS2 / BR-08: commercial refund and physical stock-disposition Woo bridge effects.
- WS1 / FE-06: payment-return/register-state cashier UX.

PR #62 imported only the accepted WS2 and WS1 owner contributions onto the already-accepted WS3 receiver. The resulting receiver commit is `d54a916946a6dcf0dfbc636d93528ac58a77ca1b`.

## Verification

- WS3 source CI `35008724817`: Linux + Windows SUCCESS.
- PR #62 exact combined CI `35017127991`: Linux + Windows SUCCESS.
- Post-integration receiver CI `35017460256`: Linux + Windows SUCCESS.
- Post-integration receiver gate includes fresh Supabase reset, pgTAP, lint, typecheck, unit tests, production build and E2E.
- BR-08 / #60: CLOSED / COMPLETED.
- FE-06 / #11: CLOSED / COMPLETED.

## Remaining disposition

RT-01 implementation is combined and automated acceptance evidence is green. Remaining work is control-plane closure/reconciliation only; no new RT-01 feature implementation is currently justified by the accepted scope.

Provider/runtime safety gates remain deliberately deferred and are **not** RT-01 completion claims:

- No approved Paystack TEST sandbox credential is present for R7 milestone acceptance.
- No real provider refund is authorized.
- No real Woo refund/restock is authorized.
- No production mutation/promotion is authorized.
- `opened_resellable` / `defective` remain fail-closed without an approved tenant restock policy.
- Concrete Paystack refund create remains fail-closed where provider idempotency/recovery cannot satisfy ADR-015.

## Next boundary

Do not open an R8 milestone PR while R7 PR #58 remains the active milestone review surface. R7 must complete its Paystack TEST sandbox acceptance, final freshness, independent review and authorized merge before the next protected-main milestone integration.
