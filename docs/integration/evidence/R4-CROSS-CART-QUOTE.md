# R4 cross-cart quote isolation

NEW ADR-012 continuation. Not Pass 3 of `R4-REVIEW-REMEDIATION-FRESHNESS.md`.
Start snapshot: `R4-CROSS-CART-QUOTE-START-FRESHNESS.md` UTC `2026-09-13T23:03:25Z`.

Reviewed head at assignment: `9703b275e16e3f333756e23c5fd1b23b74d5493c`
Independent reviewer: @Emmanuel-coder-prog **CHANGES_REQUESTED** on that exact SHA (`2026-09-13T22:53:38Z`). Prior reviews retained as history; not dismissed.
Base: `origin/main` `516d6a49af74cc6677f67bdf843de6e819a05feb`

Contracts: v1.0.0 consumed; **none changed**.
Issue #4: OPEN. `pricingParityVerified`: false. R5: **not started**. Production untouched.
Milestone delivery: **AWAITING INDEPENDENT RE-REVIEW**.

Emmanuel accepted Sell init stability, live `changed`, and catalog cursor on `9703b27…`. Those fixes are preserved.

CORE-04 remains COMPLETE / INTEGRATED_AND_TESTED.
FE-03 remains RUNTIME COMPLETE / INTEGRATED_AND_TESTED.
FE-04 remains QUOTE-STATE INTEGRATION COMPLETE.

## Defect

Stored remote quotes included `cartId`, but render applicability used only `remote.revision === revision`, and stale-response suppression used `latest.revision > requestRevision` without requiring the same cart. Cart A at revision 4 could reject Cart B revision 1 after New Sale, and equal revisions could display Cart A’s confirmed total on Cart B.

## Invariant

Quote authority is `(cartId, cartRevision)`. Revision ordering is meaningful only within one cart identity.

## Behavior now

- `remoteQuoteForCartRevision()` applies a stored remote quote only when both cart identity and revision match.
- New Sale / empty Cart B shows `missing`; Cart B with lines and no matching remote shows `quoting`. Cart A totals/fingerprints are not displayed.
- `shouldIgnoreStaleQuoteResponse()` ignores a late lower revision only when `latest.cartId` is the request cart. Cart A revision 10 cannot suppress Cart B revision 1.
- `previousConfirmedQuoteForRequest()` still returns confirmed only for the same cart + revision (no cross-cart `changed`).

## Files

- `apps/pos-web/src/features/sell/runtime/useCartQuote.ts`
- `apps/pos-web/e2e/sell-runtime.spec.ts`
- `tests/frontend/sell-quote-runtime.test.ts`
- this evidence / STATUS / HANDOFF / CURRENT-WORK

## PRE-R5 HARDENING (still deferred)

- catalog query/index performance
- QuoteRequest/Quote runtime schema validation

## Combined-tree commands (Node 24.21.0, pnpm 12.4.1)

```text
python scripts/verify_control_plane.py
python -m unittest discover -s tests/tooling -v
pnpm install --frozen-lockfile
pnpm --dir apps/pos-web lint
pnpm --dir apps/pos-web typecheck
pnpm --dir apps/pos-web test
pnpm --dir apps/pos-web build
pnpm --dir apps/pos-web test:e2e
pnpm --dir apps/pos-web exec playwright test --config ../../tests/frontend/visual/playwright.config.ts
git diff --check
```

| Command | Result |
| --- | --- |
| control-plane | PASS |
| tooling | **48 tests OK** |
| frozen install | PASS |
| lint | PASS |
| typecheck | PASS |
| Vitest | **42 files / 240 tests PASS** |
| production build | PASS |
| App E2E | **5 passed** |
| Isolated visual Playwright | **12 passed** (PNG harness output restored; not committed) |
| `git diff --check` | clean |

Regressions identified on this tree:

| Proof | Where |
| --- | --- |
| Cart A higher revision cannot suppress Cart B lower revision | helper + E2E New Sale Cart A Rev 4 GHS 40.00 → Cart B Rev 1 GHS 15.00 |
| same revision across carts cannot reuse Cart A quote | helper + E2E equal-revision New Sale while Cart B quoting |
| New Sale B shows quoting while awaiting B | E2E `data-quote-status=quoting`, no GHS 40.00 |
| B’s own quote is accepted | E2E confirmed GHS 15.00 |
| no A total/fingerprint on B | E2E `GHS 40.00` count 0 after New Sale |
| same-cart late lower revision still rejected | `shouldIgnoreStaleQuoteResponse` + existing delayed-revision helper |
| confirmed → offline → same-cart revalidation → changed | existing E2E still passing |
| initialization restore-count | existing E2E still passing |
| cursor pagination | catalog-projection Vitest still passing |
| journal idempotency | operation-journal Vitest still passing |

Independent reviewer for the replacement head: **@Emmanuel-coder-prog**. Do not ask @Ben-001-sys to independently approve. Do not self-approve, merge, or start R5.
