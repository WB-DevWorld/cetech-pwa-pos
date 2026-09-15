# R6 CP-04 chronology — do not erase historical PASS

Kind: INTEGRATION_CHECKPOINT
UTC: 2026-09-15T02:25:00Z
Editor: `@wbdevworld` / WS3 (R6 integration editor)
Neutral branch: `batch/r6-first-real-cash-sale`
PR: #55 (draft)

This note restores provenance that later R6 scheduler text briefly flattened. It does **not** authorize an R6 sale. Original evidence files were **not** cherry-picked (they remain on `origin/ws3/cp-04-r2-runtime-gates`). Merged R2 PR #43 consumed them by reference.

## Provenance (do not duplicate)

| Item | Location |
| --- | --- |
| Evidence branch | `origin/ws3/cp-04-r2-runtime-gates` (head `edf24afaf7d57d6109a761820f5cfb8bc548973f`; **not** an ancestor of `main`) |
| W1 plan / PASS record | `docs/integration/evidence/CP04-W1-OUTBOUND-CONTAINMENT.md` at `af7e2a268229b2fe4cf6a3df495dc030646328ac` |
| W1 apply | `docs/integration/evidence/CP04-W1-CONTAINMENT-APPLY.md` on the same branch |
| W2 map | `docs/integration/evidence/CP04-W2-WRITE-BOUNDARY.md` at `1f1a04f2b904e017aec01b8e58c5222e502111a8` (post-W4 fingerprints later on that branch) |
| W3 health fixtures | `docs/integration/evidence/CP04-W3-SYNTHETIC-FIXTURES.md` on the same branch |
| W4 PASS | `docs/integration/evidence/CP04-W4-BRIDGE-SERVICE-ACCESS.md` at `67ea42ce03142fb9f0ca18446b8146b0815ea621` |
| W4 freshness head | `edf24afaf7d57d6109a761820f5cfb8bc548973f` |
| R2 consumption on `main` | `docs/integration/evidence/R2-CP04-W4-CONSUMED.md` via merged PR #43 `ab9aa5ae3dcc79d51efb22c19bd1f17f38d57f77` |
| Issue #4 W4 comment | 2026-09-13: WordPress-side health PASS; overall CP-04 incomplete; issue stays OPEN |

## Classifications (conceptual)

```text
CP04-W1:
HISTORICAL PASS — training containment applied and tested 2026-09-13.
CURRENT FRESHNESS: CURRENT_PASS (2026-09-15 WP-CLI/SSH). Re-check again immediately before any sale.

CP04-W4:
HISTORICAL PASS — least-privilege WordPress bridge identity and authenticated health verified.
CURRENT FRESHNESS: CURRENT_PASS for identity/health (2026-09-15). Training plugin remains `0.2.7-br02`; BR-07 sale routes are DRIFTED vs the R6 tree.

CP04-W2:
PASS — resource/write-boundary map exists.
R6 SALE WRITE AUTHORIZATION: NOT GRANTED.
(Order writes authorized: NO; Stock writes authorized: NO; Payment writes authorized: NO)

CP04-W3:
PASS as health-fixture planning (no commerce/customer fixtures).
R6 rehearsal needs a separate synthetic cash-sale fixture plan.

R6 remaining gate:
CURRENT SAFETY FRESHNESS + EXPLICIT ONE-SALE WRITE AUTHORIZATION + EXECUTION.
BR-07 plugin routes on training: DRIFTED (`0.2.7-br02` vs R6 `0.4.0-br07`).
```

W1 authorization granted mail containment for the R2 health/install operation. W4 authorization granted Actions A–G (plugin install/identity/health) only. Neither grant is an R6 order/stock/tender grant. PR #43 recorded: production not touched; no orders/stock/payments.

## 2026-09-15 freshness (no writes)

Host: `https://training.cetechbpa.com` (`cetechtrainingappserver`). Methods: public HTTPS; operator-provided SSH as `ubuntu` then WP-CLI as `cetechtraining`. No plugin/user/order/stock/payment/mail mutation. Application Password was used only on-host for health GET and was not printed, copied to git, or rotated. Production was not touched.

A different local SSH alias was rejected earlier after hostname/path mismatch; that host was not treated as training.

| Check | Result |
| --- | --- |
| `WP_ENVIRONMENT_TYPE` | CURRENT_PASS `staging` |
| `home` / `siteurl` | CURRENT_PASS `https://training.cetechbpa.com` |
| Public REST name contains TRAINING | CURRENT_PASS |
| Comparison host `https://cetechbpa.com` distinct; no `cetech-pos/v1` | CURRENT_PASS (public distinction only; isolation still NOT PROVEN) |
| Training vs production DB fingerprint | UNVERIFIED |
| W1 MU `cetech-cp04-w1-mail-containment.php` | CURRENT_PASS PRESENT |
| MailPoet 5.37.0 | CURRENT_PASS inactive |
| `admin_email` / stock-notify / new-order recipient domains | CURRENT_PASS `training.invalid` |
| Woo webhooks | CURRENT_PASS 0 |
| mail queue | CURRENT_PASS empty |
| W1 rollback JSON / sink log | CURRENT_PASS present (sink line count now 10; was 2 after W4 — growth not investigated; no new mail sent this assignment) |
| Anonymous health | CURRENT_PASS HTTP 401 `AUTH_REQUIRED` |
| Authenticated health (existing W4 secret, not displayed) | CURRENT_PASS HTTP 200 `ok=true` `status=healthy`; Woo/WoodMart/B2BKing detected; `pricingParityVerified=false`; contract `1.0.0` |
| Authenticated health without capability | UNVERIFIED this pass (would require a second identity or cap mutation) |
| Service user | CURRENT_PASS `cetech-pos-bridge-svc` ID 22 subscriber; `cetech_pos_bridge_access=YES`; `manage_options=NO`; `manage_woocommerce=NO`; administrator=NO |
| Application Password | CURRENT_PASS one label `cetech-pos-bff-r2-health`; secret file present mode 600; not rotated |
| Installed plugin | CURRENT_PASS active **`0.2.7-br02`** (health/quotes only) |
| BR-07 routes `/sales/prepare` `/sales/finalize` resolve | **DRIFTED** — not registered. R6 tree plugin is `0.4.0-br07` |
| Paystack | CURRENT_PASS `woo-paystack` 5.8.5 inactive |
| Delivery VitePOS adapter | CURRENT_PASS `'0'` |
| HPOS order count | CURRENT_PASS 51 (unchanged since W4/R3) |
| Product `49150` | CURRENT_PASS simple/publish/price 40; **manage_stock=NO**; SKU empty (R3 name `P-SIMPLE-A` is not a Woo SKU). Unsuitable for a stock-qty fingerprint |
| Stock-managed candidate `49111` | CURRENT_PASS simple; SKU `49111`; manage_stock YES; stock **6**; price 29 |

## Authorization search (this assignment)

Searched CURRENT-WORK, CP-04 remaining work, R2/R3/R6 evidence, issue #4 / #25 / #54 comments, PR #43 / #55. No explicit grant for one synthetic training Woo order + stock effect + cash tender was found. W2 map still says those writes are **NO**.

```text
R6_STAGING_PREFLIGHT = READY_FOR_OPERATOR_AUTHORIZATION
R6_STAGING_WRITE_AUTHORIZATION = NOT_GRANTED
```
