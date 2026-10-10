# R-F4 follow-up — write boundary, receipt adopt, asserted DB-SEC

Status: **SOURCE-REPAIRED + TEST-QUALIFIED (disposable/local)**  
Hosted: **NOT applied** · Tester Preview still **452c446** · Production: **NONE**  
staff_documentation_impact: **NONE** (PR checkbox set)

## Closure route (R-F4-01)

Selected option 1: database write-boundary tender enforcement via
`20261009150000_pos_sale_tender_write_boundary.sql` — triggers on
`pos_cash_movements` (cash_sale) and `pos_checkout_payments` call
`pos_claim_or_require_tender_family`. Legacy writers that skip app-level
`claimSaleTender` cannot create opposite-family effects.

Rollback: drop the two guards + helper; retained app-level claim remains.

## Also in this batch

| Item | Result |
| --- | --- |
| R-F4-02 canonical receipt adopt | finalize-sale stores durable snapshot |
| R-F4-03 disabled shift open | denied in pos_shift_before_insert; asserting probes |
| R-F4-04 RPC conflict narrowing | strict replay validation in pos_record_verified_cash_sale |
| Mixed-gen Vitest | legacy 452c446 cash after electronic claim → zero cash rows |
| Staff-doc PR checkbox | No staff documentation impact |

## Migrations proposed (not hosted)

`20261009130000`, `20261009130100`, `20261009140000`, `20261009150000`