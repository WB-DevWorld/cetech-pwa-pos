# R10 automated qualification map

Status: **PREPARED / EXECUTABLE ON THIS BRANCH**

Purpose: map the already-merged R6–R8 executable evidence to the QA-01 qualification matrix and identify only the remaining dependency-independent gaps. This document does not upgrade historical tests into staging/runtime acceptance.

## Discovery rule

The canonical Vitest configuration already discovers:

- `tests/integration/auth/**/*.test.*`
- `tests/integration/health/**/*.test.*`
- `tests/integration/sales/**/*.test.*`
- `tests/integration/payments/**/*.test.*`
- `tests/integration/returns/**/*.test.*`
- `tests/contracts/**/*.test.*`

The new R10 guard tests therefore live under the existing `tests/integration/payments/**` discovery path and require no test-runner/configuration change.

## R6 cash / sale mapping

| Matrix ID | Executable evidence | What it proves | Remaining runtime evidence |
| --- | --- | --- | --- |
| Q-TX-PRE | `tests/integration/sales/r10-fail-closed-prepare-guards.test.ts` | wrong register authority or missing CSRF is rejected before Woo order / stock-reservation attempt | accepted staging negative-path proof later |
| Q-TX-00 | `tests/integration/sales/r10-fail-closed-finalize-guards.test.ts` | wrong register authority, missing CSRF, or missing verified payment evidence is rejected before commercial finalizer / stock effect | accepted staging negative-path proof later |
| Q-TX-01 | `apps/pos-web/src/server/sales/core-06-cash-sale-harness.test.ts` — duplicate prepare same key | one commercial order reused | accepted STG-01 path |
| Q-TX-02 | same file — changed prepare body conflicts | changed semantic request cannot reuse idempotency key | accepted STG-01 path |
| Q-TX-03 | same file — lost prepare response recovers existing Woo order | resolve-before-retry at commercial boundary | accepted STG-01 path |
| Q-TX-04 | same file — duplicate cash/finalize | one cash ledger + one commercial/stock effect | accepted STG-01 path |
| Q-TX-06 | `tests/integration/payments/r10-fail-closed-payment-guards.test.ts` — missing prepared sale | absent commercial prerequisite cannot reach payment initialize | staging outage/failure injection later |
| Q-REC-01 | CORE-06 harness + `tests/contracts/producer-consumer.test.ts` | completed sale resolves stable receipt contract | accepted staging reprint trace |

## Cash payment mapping

| Matrix ID | Executable evidence | What it proves | Remaining runtime evidence |
| --- | --- | --- | --- |
| Q-CASH-00 | `tests/integration/sales/r10-fail-closed-cash-guards.test.ts` | wrong register authority or missing CSRF creates no cash movement and no payment record | accepted staging negative-path proof later |
| Q-CASH-01 | CORE-06 cash harness | duplicate cash confirmation yields one ledger/tender effect | accepted STG-01 cash-sale trace |

## R7 payment mapping

| Matrix ID | Executable evidence | What it proves | Remaining runtime evidence |
| --- | --- | --- | --- |
| Q-PAY-01 | `tests/integration/payments/electronic-payment.test.ts` webhook/callback verification tests | browser/webhook input cannot bypass trusted server verification | final-candidate regression only |
| Q-PAY-02 | same file — exact amount/currency/reference verification | provider success is bound to expected commercial identity/economics | historical Paystack TEST evidence already exists |
| Q-PAY-03 | same file — duplicate events; out-of-order pending→success; stale failure after verified | duplicate/out-of-order events are monotonic/idempotent | final-candidate regression |
| Q-PAY-04 | same file — pending repeat/new key; pending resolve | pending intent cannot trigger second initialize | final-candidate regression |
| Q-PAY-05 | same file — late success reconciles original reference | late success logic exists and does not mint a replacement intent | controlled TEST execution only if separately authorized |
| Q-PAY-06 | `tests/integration/payments/durable-electronic-store.test.ts` + electronic-payment concurrency tests | verified payment/finalizing sale survive stale weaker writes | final-candidate regression |
| Q-SEC-02 | `tests/integration/payments/r10-fail-closed-payment-guards.test.ts` — missing CSRF | payment provider is not called when mutation protection fails | accepted STG-01 CSRF path |
| Q-SEC-03 | electronic-payment wrong org/location + auth assignment tests | tenant/location mismatch cannot access payment state | final-candidate regression |
| Q-SEC-05 | R10 assignment-unavailable guard + existing staff authorization tests | authority/infrastructure failure blocks before money movement | accepted STG-01 negative test |

## R8 return / register mapping

| Matrix ID | Executable evidence | What it proves | Remaining runtime evidence |
| --- | --- | --- | --- |
| Q-RT-01 | `tests/integration/returns/historic-sale-projection.test.ts` + R8 historic lookup tests | durable orderLineId is the return identity; receipt index is not authority | final regression |
| Q-RT-02 | `tests/integration/returns/r8-review-remediation.test.ts` + `return-runtime.test.ts` | exact historic allocation, odd-minor remainder, over-quantity rejection | final regression |
| Q-RT-03 | `return-runtime.test.ts` identical retry/concurrency tests | commercial effect identity is idempotent at integration-test level | controlled staging effect if authorized |
| Q-RT-00 | `tests/integration/returns/r10-fail-closed-return-effects.test.ts` | missing approval, wrong register assignment, or missing CSRF is rejected before provider refund, commercial refund, or stock-disposition calls occur | accepted staging negative-path proof later |
| Q-RT-04 | `return-runtime.test.ts` mixed outcomes + independent bridge effects | settlement/commercial/stock effects remain independently truthful | controlled staging evidence |
| Q-RT-05 | `r8-review-remediation.test.ts` + `return-runtime.test.ts` disposition tests | damaged/quarantine-like paths do not invent sellable restock | controlled staging evidence |
| Q-RT-06 | `return-runtime.test.ts` lost-provider-response/resolve tests | ambiguous refund resolves same refundId; no second refund | final regression |
| Q-REG-02 | `tests/integration/sales/close-shift-variance.test.ts` | non-zero variance remains requires_attention | final regression |
| Q-REG-03 | same file — invented/arbitrary UUID cases | approval-shaped input has zero close authority | final regression |

## Authentication / security mapping

| Matrix ID | Executable evidence | What it proves |
| --- | --- | --- |
| Q-SEC-01 | `tests/integration/auth/staff-authorization.test.ts`, `staff-session-http.test.ts`, health anonymous tests | anonymous/expired/revoked requests fail closed |
| Q-SEC-02 | staff authorization/session HTTP tests + R10 payment/return no-effect guards | origin + CSRF are enforced before payment/refund/stock external effects |
| Q-SEC-03 | staff assignment directory, payment cross-tenant, return cross-tenant tests + R10 return no-effect guard | cross-tenant/cross-location/register authority is rejected before external effects |
| Q-SEC-04 | `tests/integration/auth/secrets.test.ts`, `tests/integration/health/env.test.ts`, session/health route secret tests | public secret aliases and privileged browser exposure are rejected by executable checks |
| Q-SEC-05 | auth provider timeout/unavailable tests + new R10 payment guard | infrastructure uncertainty does not become trusted access or payment execution |

## Durable restart mapping

| Matrix ID | Executable evidence | What it proves | Remaining runtime evidence |
| --- | --- | --- | --- |
| Q-TX-03 / Q-PAY-06 | `tests/integration/sales/durable-checkout-store.test.ts`, `tests/integration/payments/durable-electronic-store.test.ts` | sale/payment/receipt/idempotency/provider-event state survives new store instance | accepted staging/process restart trace |
| Q-RT-06 | return-runtime durable recovery test | return effect IDs survive a new orchestrator | controlled staging if enabled |

## Deliberately not automated here

These remain runtime/device/release evidence, not unit-test substitutes:

- Q-TX-05 authoritative live quote/stock-change review against accepted training runtime;
- Q-PWA-01 through Q-PWA-06 installed-client/update/reconnect/multi-tab proof;
- Q-REG-04 one immutable Z report under real R9 close/retry path;
- physical scanner/printer evidence;
- backup/restore rehearsal;
- VitePOS queue/shift/inventory reconciliation;
- application rollback and pilot.

## New R10 dependency-independent tests

`tests/integration/payments/r10-fail-closed-payment-guards.test.ts` adds only no-effect guards not previously asserted explicitly at the payment-provider boundary:

1. missing prepared sale → NOT_FOUND and `provider.initializeCount === 0`;
2. unavailable staff-assignment authority → INTEGRATION_UNAVAILABLE and `provider.initializeCount === 0`;
3. missing CSRF → FORBIDDEN and `provider.initializeCount === 0`.

`tests/integration/sales/r10-fail-closed-prepare-guards.test.ts` adds the pre-commerce effect-boundary proof:

1. wrong register assignment → FORBIDDEN with zero Woo-order / stock-reservation effects;
2. missing CSRF → FORBIDDEN with zero Woo-order / stock-reservation effects.

`tests/integration/sales/r10-fail-closed-cash-guards.test.ts` adds the cash-tender effect-boundary proof:

1. wrong register assignment → FORBIDDEN with zero cash movements / payment evidence;
2. missing CSRF → FORBIDDEN with zero cash movements / payment evidence.

`tests/integration/sales/r10-fail-closed-finalize-guards.test.ts` adds the finalization effect-boundary proof:

1. wrong register assignment → FORBIDDEN with zero commercial payment-complete / stock effects;
2. missing CSRF → FORBIDDEN with zero commercial payment-complete / stock effects;
3. missing verified payment evidence → PAYMENT_NOT_VERIFIED with zero commercial payment-complete / stock effects.

`tests/integration/returns/r10-fail-closed-return-effects.test.ts` adds the equivalent R8 effect-boundary proof:

1. approval-required return without approval → zero provider-refund, commercial-refund and stock-disposition calls;
2. wrong register assignment → FORBIDDEN before any of those effects;
3. missing CSRF → FORBIDDEN before any of those effects.

These tests do not change source behavior and do not authorize any external payment, refund, Woo mutation or stock change.
