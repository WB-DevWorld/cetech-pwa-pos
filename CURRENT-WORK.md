# Current work ledger

Updated 2026-09-15. Canonical repo `WB-DevWorld/cetech-pwa-pos`. Historical scheduler detail remains in Git/PR/evidence history. This file controls current assignment and implementation authority.

## Current authority

- `main`: `bd79c2901ce33c3177141d4244cc196be0a719d2` — R6 PR #55 merge; protected.
- ADR-012, ADR-014 and accepted ADR-015 are active; ownership-preserving milestone execution remains required.
- Issue #4 remains **OPEN**. `pricingParityVerified=false`. Production promotion is not authorized.
- Live electronic payment is not authorized. Live refund/restock is not authorized.
- R7 is not merged. R8 milestone review is not started.

## R7 — electronic payment and reconciliation — PROVISIONAL_TEST / SANDBOX DEFERRED

- Integration issue: **#57**.
- Implementation task: **PAY-01 / #26**.
- Neutral branch: `batch/r7-electronic-payment-reconciliation`.
- Milestone PR: **#58 draft**.
- Exact code-ready head: `9ab7e5b7cf2b5d4f253f9d41468726c31cbfc091`.
- Automated code/contract gate is green.
- Sandbox milestone gate remains blocked because no approved Paystack TEST secret (`sk_test_...`) is present through the authorized server/local secret mechanism.
- Do not mark #58 ready, request final review, merge, run live electronic payment, or promote production until the sandbox gate is completed.

```text
PAYMENT PROVIDER SANDBOX GATE: BLOCKED_SANDBOX_CREDENTIALS
```

## RT-01 safe returns preparation — COMBINED INTEGRATION ACCEPTED

The senior/user explicitly authorized continuing safe-return preparation while R7's provider sandbox gate is deferred. This is preparation/provisional work only; it does not imply R7 acceptance or start an R8 milestone review.

Accepted contract:
- ADR-015 / return-refund contract exact head `58d385300bfba784435448029e88f07742048cde`.
- Required cross-owner contract reviews: Ben / WS1 APPROVED; Emmanuel / WS2 APPROVED.

Accepted owner implementations:
- WS3 RT-01 runtime source `4650a0fa18c909743e9fbab4be0b6067bd1eff18` — accepted for neutral integration after exact-head Linux + Windows CI.
- BR-08 / #60 WS2 source `dcf9098a331f878647e067fc78b3c05778f8f668` — completed and integrated.
- FE-06 / #11 WS1 source `0ddde7c727337c4005e9878071817bbf826d41a2` — completed and integrated; remediation source includes `d3ddf0a7592845c710fe768b3645b9a9109693cb`.

Combined receiver:
- branch: `batch/rt01-safe-returns-ws3-integrated`
- receiver before owner imports: `4650a0fa18c909743e9fbab4be0b6067bd1eff18`
- BR-08 import: `79d9270a418ec958ffd716b7a20a8d1c213b5e8d`
- FE-06 import: `bc521c598b834930d2fd6b56c8225b2b08a3ec2a`
- exact integrated receiver: `d54a916946a6dcf0dfbc636d93528ac58a77ca1b`
- PR #62 combined CI `35017127991`: Linux + Windows SUCCESS.
- post-integration receiver CI `35017460256`: Linux + Windows SUCCESS, including Supabase reset, pgTAP, lint, typecheck, unit tests, production build and E2E.

Owner task disposition:
- BR-08 / #60: **CLOSED / COMPLETED**.
- FE-06 / #11: **CLOSED / COMPLETED**.
- RT-01 / #27: combined implementation is integrated and automated acceptance evidence is green; final control-plane closure/reconciliation is the remaining repository action.

## RT-01 safety boundaries retained

- No real Woo refund or real stock disposition is authorized.
- No live Paystack/provider refund is authorized.
- No production mutation or promotion is authorized.
- Historic sale economics remain authoritative for returns/refunds; do not reprice from current catalog state.
- Tender refund, Woo commercial refund accounting and physical stock disposition remain independent effects with independent durable identities/idempotency and resolve paths.
- Damaged, quarantine and not-physically-returned goods must not auto-restock sellable stock.
- `opened_resellable` / `defective` remain fail-closed without an approved tenant restock policy.
- Concrete Paystack refund create remains fail-closed where the provider cannot satisfy the accepted durable idempotency/recovery contract.

## Next milestone boundary

Do not open or merge an R8 milestone PR while R7 PR #58 remains the active milestone review surface. Work that can proceed safely against accepted contracts/mocks may continue only within explicit ownership/path authority. The next merge to protected `main` remains R7 after its provider sandbox acceptance, final freshness, independent review and authorized merge.
