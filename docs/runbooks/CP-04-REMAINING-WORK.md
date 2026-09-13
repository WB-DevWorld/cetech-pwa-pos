# CP-04 remaining implementation and evidence

Controlling decision: [ADR-011](../decisions/ADR/011.md). Owner: WS3 senior / @wbdevworld; WS2 supplies commerce evidence and the environment operator supplies access/configuration evidence. Tracker: [issue #4](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/4), kept OPEN.

| Gate | Current state | Meaning |
| --- | --- | --- |
| Development baseline | SATISFIED | Training is the reference. CORE-01 local schema/RLS and BR-01 local implementation may proceed when their other prerequisites are met. |
| Controlled remote write testing | OPEN; training isolation vs production NOT PROVEN; **email contained on training for CP04-W1** | W4 bridge install still needs a separate operator grant. No test orders, stock changes, live messages or real charges are authorized by this document. |
| Production cutover | OPEN / DEFERRED | Production differences must be resolved before their affected capability is enabled. They do not block unrelated development. |

## Already established

The [authenticated audit](../integration/evidence/CP-04-AUTHENTICATED-AUDIT.md) records training identity, WP/Woo/plugin versions, PHP-FPM versus CLI, HPOS authoritative tables with compatibility sync off, Woo manage-stock, 60-minute hold setting, observed backorder metadata, GHS/two decimals, tax calculation off, active gateway list and VitePOS outlet/counter counts. The [public audit](../integration/evidence/CP-04-LIVE-AUDIT.md) supplies the SKU barcode configuration.

These are baseline observations, not proof of plugin compatibility, stock reservation semantics, pricing parity, queue drainage, settlement or fiscal compliance. Do not repeat a completed read solely to make issue #4 appear complete; recheck when configuration changes or a specific test needs freshness.

## Next bounded CP-04 work

Execute one environment task at a time, with the intended host, allowed configuration changes, synthetic test identities, rollback and acceptance stated before mutation. This repository update changes requirements only.

| ID | Action / owner | Closure evidence | When required / safe progress while pending |
| --- | --- | --- | --- |
| CP04-W1 | Contain outbound side effects. WS3 + training operator inspect and configure mail capture/blocking for Woo and MailPoet, notification integrations, fulfillment and webhook destinations. | **PASS** for R2 W4 health/install on training 2026-09-13: MailPoet inactive, `wp_mail` intercept, `.invalid` sink, synthetic captured. Evidence `docs/integration/evidence/CP04-W1-CONTAINMENT-APPLY.md`. Other channels (Chaty/CF7/fulfillment) remain UNVERIFIED and unused. | Before training events that could notify customers or trigger fulfillment. Mail path for planned W4 is contained. Continue local implementation. |
| CP04-W2 | Establish the data/write boundary for the chosen test environment. WS3 + operator use dedicated disposable storage/services, test-only credentials and approved destinations; document training boundaries before training writes. | Operator-confirmed resource mapping and containment evidence for the actual databases, stock/orders, services and credentials used. Compare production fingerprints if available; absence of production access is not a prerequisite for a separately isolated local sandbox. | Before remote stock/order mutations. Production identity/parity remains a later delta; no broad production access hunt for CORE-01. |
| CP04-W3 | Prepare synthetic or appropriately sanitized fixtures. WS3 + WS2 use non-customer recipients and minimal test records. | Fixture provenance and sanitization checks; no customer/order exports or secrets committed. | Before copying data into local/CI/preview environments or exercising customer-facing side effects. Local tests use synthetic fixtures now. |
| CP04-W4 | Establish bridge service access for the target runtime. WS2 implements BR-01; an authorized operator provisions a dedicated least-privilege service identity through the approved credential channel. WS3 configures the BFF adapter. | Authenticated health, unauthorized-denial tests, capability/scope evidence and secret-free responses. Installation and credential provisioning are separate explicit environment actions. | Before live BR-01/CORE-03 connectivity acceptance. Local plugin implementation and permission tests do not wait for production credentials. |
| CP04-W5 | Establish the approved payment sandbox. WS3 + payment account owner obtain test credentials and verify test destinations/mode; production keys remain outside local/CI/preview. | Redacted test-mode/provider-account evidence and server-verifiable synthetic payment results in PAY-01. Inactive Paystack and invoice/COD alone do not prove a sandbox. | Before external payment execution. Provider-neutral code can be implemented locally; real-money enablement remains a release decision. |

These operational safeguards must not be replaced with guessed settings or a generic waiver. If the available training environment cannot be contained, use a deliberately isolated synthetic environment and keep its limitations visible.

## Downstream proof owned by implementation tasks

| Task owner | Required proof | CP-04 contribution |
| --- | --- | --- |
| WS2 BR-02–BR-05 | Woo/WoodMart/B2BKing quote parity, buyer isolation, overlap and relevant tax cases | Exact reference configuration and permitted test environment; configured tax-off is not statutory signoff |
| WS2 BR-06/BR-07 + WS3 CORE-06 | Idempotent order/stock effects, reserve/expiry behavior, concurrency and real cash-sale recovery | Safe synthetic transaction environment; the 60-minute option alone proves no reservation behavior |
| WS3 CORE-01/CORE-02 | Local schema reset/RLS denial and server authorization tests | Development baseline already satisfied; cloud Supabase and production Woo are unnecessary for local schema proof |
| WS3 PAY-01/RT-01/CORE-07/QA-01 | Verified payment/refund, shift closure and installed-PWA/failure recovery | Applicable sandbox, device and test configuration; no mock result closes a live gate |

CP-04 gathers facts and enables safe evidence collection. It does not take ownership of bridge, schema, payment or frontend implementation.

## Production delta register — resolve at the affected release gate

All production values below remain **UNVERIFIED** unless updated with direct evidence. Record each change here or in linked evidence with value, environment, checker, UTC, method and limitations.

| Delta | Training baseline | Owner | Required before / fallback |
| --- | --- | --- | --- |
| Operations host, data stores, credentials, deployment/Supabase project and recovery contacts | Training identity known; production Woo operations identity and deployment details unverified | WS3 + operator | Production connection/deployment; use local development meanwhile |
| Woo/plugin versions, HPOS, currency/precision and commercial/tax rules | Authenticated training values documented | WS2 + business owner | Enabling production quoting/checkout; rerun parity against actual target; reject unsupported configurations |
| Stock model, outlet/register mapping, backorders, fractional quantity and reserve/reduce/expiry semantics | Woo stock on; observed VitePOS stockable flag off; two outlets/counters; runtime effects unproven | WS2 + store operator | Live inventory/order writes; defer unsupported capabilities explicitly |
| Email, SMS/WhatsApp, fulfillment, webhooks and dataset policy | Training **email contained** for CP04-W1 (MailPoet inactive, intercept + `.invalid` sink); SMS/fulfillment/dataset still not fully proven | WS3 + operator | Applicable remote side effects and production enablement; keep test sinks in nonproduction; do not auto-restore MailPoet |
| Payment account, live processor, settlement and refund permissions | Paystack inactive; invoice/COD runtime; operational card/MoMo reported separately | WS3 + payment owner | Real-money capability enablement; disable an unavailable electronic method explicitly |
| Fiscal process and production invoice owner | Woo tax calculation off; fiscal process unverified | Business/fiscal owner + WS3 | Production selling/invoicing; requires approved process, not an invented software fallback |
| Scanner, printer, drawer, terminal, staff roles and cash variance policy | Hardware/production policy unverified | Store operator + respective workstream | Relevant production workflow and pilot; record actual device and role tests |
| Every VitePOS device queue, active shift, stock reconciliation and rollback | Config flags/counts only; no device queue/shift proof | Store operator + WS2 + WS3 | REL-01 pilot; reconcile pending work, prove restore/rollback and avoid competing register writers |

## Acceptance and next action

Keep issue #4 open as the tracker. A development task may proceed when its relevant baseline is satisfied even while the issue remains open. Close a write-safety item only for the evidenced operation/environment; close the overall tracker when residuals are resolved or explicitly transferred to an owned release gate with acceptance evidence still required.

Next CP-04 assignment: **CP04-W1 outbound containment is PASS** on training (`https://training.cetechbpa.com`) after the 2026-09-13 authorized apply. W2 map and W3 fixtures remain recorded. **Do not start remote W4** until the operator separately authorizes Actions A–G (bridge install, service user, Application Password, health evidence). Evidence: `docs/integration/evidence/CP04-W1-CONTAINMENT-APPLY.md`. Preflight: `docs/runbooks/CP04-W4-BRIDGE-PREFLIGHT.md`. Keep issue #4 OPEN. Follow the [audit runbook](CP-04-STAGING-AUDIT.md) for read-only evidence collection and preserve historical audit conclusions.
