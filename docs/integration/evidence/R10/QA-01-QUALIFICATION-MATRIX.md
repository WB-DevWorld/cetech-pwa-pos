# QA-01 qualification matrix

Status: **PREPARED — execution is incomplete**

This matrix converts QA-01 / #29 into explicit evidence rows. It deliberately separates historical evidence, automated qualification, staging runtime evidence, installed-client evidence and production/pilot authorization.

## Result rules

- Never infer PASS from implementation existence.
- Never treat mock-only or in-process success as live integration acceptance.
- For an ambiguous external effect, resolve existing operation reality before retrying.
- A runtime-dependent row remains PENDING even if unit/contract tests are green.
- Each executed row must record exact SHA, environment, command or operator steps, observed IDs, result and redacted evidence.

## Transaction and order invariants

| ID | Scenario / invariant | Existing evidence to reuse | Additional R10 evidence | Status |
| --- | --- | --- | --- | --- |
| Q-TX-PRE | Unauthorized or CSRF-invalid prepare cannot invoke Woo order creation or stock reservation | R10 prepare no-effect guards | Accepted staging negative-path proof | PREPARED |
| Q-TX-00 | Unauthorized, CSRF-invalid, or payment-unverified finalization cannot invoke commercial completion or stock effect | R10 finalize no-effect guards | Accepted staging negative-path proof | PREPARED |
| Q-TX-01 | Same prepare key + same body returns same sale/order | CORE-06/R6 evidence | Re-run on accepted staging candidate | PENDING_STG01 |
| Q-TX-02 | Same prepare key + changed body conflicts; no second order | CORE-06/R6 evidence | Re-run on accepted staging candidate | PENDING_STG01 |
| Q-TX-03 | Lost prepare response resolves existing order before any retry | CORE-06/R6 evidence | Functional staging trace | PENDING_STG01 |
| Q-TX-04 | Duplicate finalize cannot repeat payment-complete/stock effect | CORE-06/R6 evidence | Functional staging trace | PENDING_STG01 |
| Q-TX-05 | Price or stock change before prepare requires review before payment | Existing contracts/tests | Real authoritative staging path | PENDING_STG01 |
| Q-TX-06 | Woo unavailable before prepare means no payment starts | Existing fail-closed design | Failure injection on accepted staging candidate | PREPARED |
| Q-TX-07 | Supabase/POS durable store unavailable prevents unsafe new tender | Existing design/tests | Failure injection on accepted staging candidate | PREPARED |

## Cash payment invariants

| ID | Scenario / invariant | Existing evidence to reuse | Additional R10 evidence | Status |
| --- | --- | --- | --- | --- |
| Q-CASH-00 | Unauthorized or CSRF-invalid cash confirmation cannot create cash movement or payment evidence | R10 cash no-effect guards | Accepted staging negative-path proof | PREPARED |
| Q-CASH-01 | Duplicate cash confirmation cannot create a second cash movement/tender | CORE-06/R6 evidence | Accepted staging cash-sale trace | PENDING_STG01 |

## Payment invariants

| ID | Scenario / invariant | Existing evidence to reuse | Additional R10 evidence | Status |
| --- | --- | --- | --- | --- |
| Q-PAY-01 | Browser callback cannot mark payment verified | R7 automated + sandbox evidence | Regression suite on final candidate | REUSE_EXISTING_EVIDENCE |
| Q-PAY-02 | Provider verification binds reference, transaction/order, exact amount and currency | R7 Paystack TEST sandbox | Regression suite on final candidate | REUSE_EXISTING_EVIDENCE |
| Q-PAY-03 | Duplicate/out-of-order webhook cannot double-tender/finalize | R7 concurrency evidence | Failure-injection regression | PREPARED |
| Q-PAY-04 | Pending/unknown payment never initializes another charge | R7 evidence | Failure-injection regression | PREPARED |
| Q-PAY-05 | Late success reconciles original intent | R7 design/tests | Controlled TEST-mode exercise only if separately authorized | PENDING_AUTHORIZATION |
| Q-PAY-06 | Verified/finalizing/completed state cannot regress to weaker state | R7 monotonic tests | Regression suite on final candidate | REUSE_EXISTING_EVIDENCE |

## Return / refund / stock-disposition invariants

| ID | Scenario / invariant | Existing evidence to reuse | Additional R10 evidence | Status |
| --- | --- | --- | --- | --- |
| Q-RT-00 | Unauthorized, unapproved, or CSRF-invalid return cannot invoke provider refund, commercial refund, or stock-disposition effects | R10 no-effect guard tests | Accepted staging negative-path proof | PREPARED |
| Q-RT-01 | Historic immutable order-line identity is used for return | R8 remediation evidence | Regression suite | REUSE_EXISTING_EVIDENCE |
| Q-RT-02 | Partial return cannot refund more historic economics than remain | R8 allocation evidence | Concurrency/failure regression | PREPARED |
| Q-RT-03 | Duplicate commercial refund effect is idempotent | R8 WS2/WS3 tests | Controlled staging effect only if separately authorized | PENDING_AUTHORIZATION |
| Q-RT-04 | Refund settlement, Woo commercial refund and physical stock disposition remain independent effects | R8 contract/evidence | Controlled staging evidence | PENDING_AUTHORIZATION |
| Q-RT-05 | Damaged/quarantine/not-physically-returned items do not silently become sellable stock | R8 tests | Controlled staging evidence | PENDING_AUTHORIZATION |
| Q-RT-06 | Unknown refund/provider result resolves existing effect; no second money movement | R8 design/tests | Failure-injection regression | PREPARED |

## Authentication / authorization / security

| ID | Scenario / invariant | Existing evidence to reuse | Additional R10 evidence | Status |
| --- | --- | --- | --- | --- |
| Q-SEC-01 | Anonymous/state-changing request rejected | Earlier auth/route tests | Accepted STG-01 session/CSRF path | PENDING_STG01 |
| Q-SEC-02 | Wrong/missing CSRF rejected without weakening origin protection | Existing BFF tests | Accepted STG-01 functional run | PENDING_STG01 |
| Q-SEC-03 | Cashier cannot access foreign organization/location data | RLS/return-lookup tests | Full final-candidate negative suite | PREPARED |
| Q-SEC-04 | Browser bundle contains no Woo/WP/Supabase/payment privileged secret | Existing scans | Final release-candidate secret scan | PREPARED |
| Q-SEC-05 | Disabled/unauthorized staff cannot perform protected mutation | Existing auth model | Functional staging negative test | PENDING_STG01 |
| Q-SEC-06 | Technical diagnostics do not expose secrets/customer PII | Existing evidence discipline | Final evidence review | PREPARED |

## PWA / durable recovery invariants

| ID | Scenario / invariant | Existing evidence to reuse | Additional R10 evidence | Status |
| --- | --- | --- | --- | --- |
| Q-PWA-01 | Active cart/draft survives refresh | Earlier local/runtime tests | Installed-device proof | PENDING_R9 |
| Q-PWA-02 | Update does not activate during active tender/critical durable work | R9 implementation/tests | Build A → B installed-client proof | PENDING_R9 |
| Q-PWA-03 | Unacknowledged operation survives reconnect/reload and resolves before retry | Existing journal design + R9 | Installed-client proof | PENDING_R9 |
| Q-PWA-04 | Multi-tab ownership/lease prevents unsafe concurrent lifecycle action | R9 tests | Real multi-tab runtime proof | PENDING_R9 |
| Q-PWA-05 | Safe-point activation preserves required local state/schema | R9 implementation | Installed-client proof | PENDING_R9 |
| Q-PWA-06 | Unsupported app version is surfaced from server-owned ReleasePolicy | R9 remediation | Installed-client/server-policy proof | PENDING_R9 |

## Register / close / receipt invariants

| ID | Scenario / invariant | Existing evidence to reuse | Additional R10 evidence | Status |
| --- | --- | --- | --- | --- |
| Q-REG-01 | Zero variance closes once and records immutable close result | R8/R9 implementation/tests | Final-candidate regression | PREPARED |
| Q-REG-02 | Non-zero variance fails closed to requires_attention | R8 remediation | Final-candidate regression | PREPARED |
| Q-REG-03 | Invented approval UUID cannot authorize variance close | R8 remediation | Regression suite | REUSE_EXISTING_EVIDENCE |
| Q-REG-04 | Close retry yields one immutable Z report | R9 implementation | Runtime/device evidence | PENDING_R9 |
| Q-REC-01 | Receipt reprint resolves original completed sale and cannot repeat sale | R6 evidence | Accepted staging trace | PENDING_STG01 |

## Operational qualification

| ID | Scenario / invariant | Required evidence | Status |
| --- | --- | --- | --- |
| Q-OPS-01 | Desktop cashier path | Accepted staging candidate, exact SHA, screenshot/log evidence | PENDING_STG01 |
| Q-OPS-02 | Supported mobile/PWA path | Device rehearsal runbook evidence | PENDING_R9 |
| Q-OPS-03 | Keyboard-wedge scanner | Physical device/model + sale/search trace | PENDING_AUTHORIZATION |
| Q-OPS-04 | Receipt printer | Physical printer/model + print/reprint evidence | PENDING_AUTHORIZATION |
| Q-OPS-05 | Backup restore | Isolated restore evidence; never production-destructive | PENDING_AUTHORIZATION |
| Q-OPS-06 | VitePOS queue/shift/inventory reconciliation | REL-01 pre-cutover evidence | PENDING_AUTHORIZATION |
| Q-OPS-07 | Application rollback without erasing legitimate new business effects | Rehearsal evidence | PENDING_AUTHORIZATION |

## QA-01 exit rule

QA-01 may be considered complete only when every enabled production capability has either:

1. explicit PASS evidence at the required level; or
2. an explicit release exclusion/kill-switch decision with no misleading UI path.

No unresolved duplicate-order, duplicate-payment, lost-journal, unauthorized-access, unsafe-refund/restock or state-loss defect may be waived by deadline pressure.
