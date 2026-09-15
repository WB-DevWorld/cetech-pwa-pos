# CORE-06 / issue #25 acceptance evidence

Task: CORE-06 / issue #25. Isolated contributor branch `ws3/core-06-integrate-real-cash-sale-and-contract-e2e-har` from exact tested R6 integration candidate `ef7660ddca607ca748cb9eb71487b856004d0817` (accepted FE-05 + BR-07). Owner / actual implementer: `@wbdevworld` / WS3.

This is not R6 complete. Do not import this SHA into PR #55 from this assignment. Do not start R7/PAY-01. `pricingParityVerified` remains false. Issue #4 remains OPEN. No production promotion.

Shared `CURRENT-WORK.md` was **not** edited (read-only scheduler). On this branch that file may still describe CORE-06 as blocked; issue #25 comments and `origin/batch/r6-first-real-cash-sale` are the implementation authority.

## Integration gap closed

FE-05 checkout existed but Sell did not mount CheckoutUseCases / PaymentPort / SalesPort.resolve / ReceiptPort / PrintPort, so Pay stayed disabled. CORE-05 BFF had cash + finalize + receipt + open-shift, but not prepare or sale/payment resolve, and quotes were not snapshotted for prepare. BR-06/BR-07 PHP already implement prepare/finalize/resolve.

CORE-06 connected those seams without rebuilding FE-05 UI or BR-07:

- Persist BFF quote snapshots and prepare from that snapshot plus SalesPort.prepare.
- Idempotent prepare with lost-response recovery via SalesPort.resolve (no second Woo order).
- GET sale resolve and POST payment resolve so the FE controller can converge after a lost response.
- Mount browser checkout ports in `pos-app.tsx`.
- Combined in-process harness (FE controller + BFF handlers + instrumented commercial double).
- Contract producer-consumer envelopes for the cash-sale types.
- Playwright Sell → mocked BFF retail and B2B cash-sale paths.

FE-05 screens and BR-07 plugin were not rewritten. Frozen v1.0.0 contracts were not edited.

## Acceptance

| Criterion | Evidence level | Result |
| --- | --- | --- |
| A. Retail cash sale | Combined in-process harness + Playwright mocked BFF | PASS. One POS sale, one instrumented Woo order, quote total GHS 15.00, one cash ledger row, one stock/payment_complete effect, one receipt, resolve returns completed. |
| B. B2B cash sale | Combined in-process harness + Playwright mocked BFF | PASS. Authoritative quote total GHS 12.00 from quote snapshot (not a frontend price). Receipt customer label `cust-buildworks` (harness) / `Buildworks Ltd` (Playwright mock). |
| C. Exactly-once | Combined in-process harness | PASS. Duplicate prepare same key → one Woo order. Same key / different body → `IDEMPOTENCY_CONFLICT`, still one order. Duplicate cash → one `cash_sale` row. Duplicate finalize → one `paymentComplete` / stock effect. Second prepare key on the same transaction reuses the existing order. |
| D. Lost prepare response | Combined in-process harness + FE controller | PASS. Instrumented port drops the prepare response after creating `woo-1`; BFF recovers via resolve and persists one sale. FE controller drops the BFF prepare HTTP result, resolves, then cash/finalize still produce one order / one tender / one stock effect. |
| E. Receipt/history recovery | Combined in-process harness | PASS. GET receipt after completion returns the same receipt id as the controller session. Resolve status `completed` with that `receiptId` and original `saleId`. |
| F. Combined proof | In-process (FE+BFF+instrumented bridge) + contract schema + Playwright | PASS at those levels. Isolated FE tests plus isolated bridge tests were not treated as sufficient. |

## Idempotency / recovery (executable)

From `apps/pos-web/src/server/sales/core-06-cash-sale-harness.test.ts` (included in `pnpm --dir apps/pos-web test`):

- Duplicate prepare, same key: `wooOrderCount === 1`, same `saleId`.
- Same key / different request: `IDEMPOTENCY_CONFLICT`, `wooOrderCount === 1`.
- Lost prepare response: recovered `PreparedSale` with `wooOrderCount === 1`; replay same key returns the same `saleId`.
- Duplicate cash + duplicate finalize: one cash ledger row; `paymentCompleteCount === 1`; `stockEffectCount === 1`.
- FE lost-prepare then cash: stage `receipt_ready`, one Woo order, one cash row.
- Second prepare key for the same transaction: still one Woo order.

## Evidence levels (do not conflate)

| Layer | Status |
| --- | --- |
| Combined Node harness (FE controller + BFF + instrumented SalesPort) | PASS |
| Frozen schema producer-consumer (`tests/contracts/producer-consumer.test.ts`) | PASS |
| Playwright Sell → mocked BFF (`apps/pos-web/e2e/cash-sale.spec.ts`) | PASS (retail + B2B) |
| Isolated staging Woo (one real order/stock/tender) | **BLOCKED** — training host `cetech-pos` REST 404; no authorized isolated Woo writes |
| Production Woo | **none** |

Mock/in-process success is not live integration acceptance.

## Commands

```text
python scripts/verify_control_plane.py
python -m unittest discover -s tests/tooling -v
pnpm --dir apps/pos-web lint
pnpm --dir apps/pos-web typecheck
pnpm --dir apps/pos-web test
pnpm --dir apps/pos-web build
pnpm --dir apps/pos-web test:e2e
git diff --check
```

Results (Windows, Node v24.21.0, 2026-09-15):

- control-plane: **PASS** (3 workstream packages, 30 scoped tasks/DAG, 28 immutable reference files, 61 schemas, 32 contract fixtures)
- tooling unittest: **PASS** (48 tests)
- lint: **PASS** (`eslint .` exit 0)
- typecheck: **PASS** (`next typegen && tsc --noEmit`)
- Vitest: **53 files / 406 tests PASS** (includes CORE-05 cash-finalize harness and CORE-06 combined harness plus producer-consumer)
- production build: **PASS** (Next.js 16.3.4). New routes: `/api/pos/v1/sales/prepare`, `/api/pos/v1/sales/[transactionId]`, `/api/pos/v1/payments/resolve`
- Playwright: **7 passed** (`cash-sale` retail + B2B; existing sell-runtime + scaffold)
- `git diff --check`: clean

Bridge PHP/Make/parity suites were not rerun: this assignment did not change `wordpress/cetech-pos-bridge/**`. Local `supabase db reset` / pgTAP were not required for this slice (no new migration).

## Contracts / migrations / ADRs

- Contracts changed: **none**. Frozen v1.0.0 consumed.
- ADRs changed: **none**.
- Migrations: **none**.

## Remote effects

- Production effects: **none**
- Staging effects: **none**
- External order IDs: none (instrumented `woo-1` / mock `woo-mock-*` only)

## Remaining risks / blockers

- Durable CORE-02 assignment directory is still empty in local `composeStaffAssignmentDirectory`; unmocked local BFF prepare is fail-closed without injected assignments. Combined proof injects assignments in the harness; Playwright mocks BFF.
- Local POS sale/payment/receipt store remains in-process memory; staging/production composition still refuses the ephemeral store.
- Isolated staging Woo writes remain unauthorized / unavailable (`LIVE-ENVIRONMENT-FACTS.md` training host 404). Do not treat this SHA as live cash-sale acceptance.
- `pricingParityVerified=false`. Issue #4 OPEN.

## Next exact action

Ready for the integration editor to import this exact contributor SHA into `batch/r6-first-real-cash-sale` and run the R6 final combined gate. Do not declare R6 merged, approved, production-ready, or cut over. Pass 3 is not permitted for this assignment.
