# RD-02 — execution request (training bridge + bounded tracks)

Status: **READY FOR OWNER DECISION** — not authorized / not executed  
Acting implementer: `@wbdevworld` / WS3  
Host: `https://training.cetechbpa.com` only  
Production effects if approved: training commerce/stock/tender only as capped below  
Production promotion: **NONE**  
Staff-documentation impact: **NONE**

This is one concrete decision request. Approving it does **not** authorize RD-03, production, VitePOS deactivation, tester-alias move, or re-apply of RD-01.

## Exact artifact

| Field | Value |
| --- | --- |
| Product tip | `ab5c7e1f3849ff65100a84058e92f8b281a14be2` |
| Bridge tree | `fc8f2d05e7fe36001c3e9265cad0b4754417fedd` |
| Equivalence | Same bridge tree on freeze tip `f0feb44…` and later docs tips |
| Package zip | `bridge-artifact-ab5c7e1/cetech-pos-bridge-ab5c7e1-fc8f2d05.zip` |
| Zip SHA-256 | `e875ec3af476e230f2571624a3d0111dc29c1856d1793481deecfc1b6dbfa503` (104200 bytes) |
| File manifest | `bridge-artifact-manifest-ab5c7e1.json` (41 files) |
| Main file SHA-256 | `63094753eb380b57c1e7e6db1a172ead3a295112e538d6722ffb4325f7ff58ab` |
| `class-woo-runtime.php` SHA-256 | `89e4461c3ff7e7ef2dc6ff525751f799f4b92604d655880e9840256128deb76c` |
| Loaded-generation proof after install | File hashes match + `assert_prepared_order_operation_identity` present; **do not** accept version header `0.6.0-stg05` alone |
| Candidate app Preview (BFF under test) | `dpl_8pUT6fhYPKxR6B7uFhoUVUx2ZYJL` — https://cetech-pos-staging-d299u3ex7-wbdevworlds-projects.vercel.app (freeze `f0feb44`); note observed release-policy `BUILD_ID=local-dev` until SHA binding proven |

## Installed baseline (rollback from)

| Field | Value |
| --- | --- |
| Active plugin | `cetech-pos-bridge` **0.6.0-stg05** |
| Main SHA-256 | `9fee0c40fd957eb0ec16bbe064fa2bb1122daec56d4d862bf0b34fc7bdc1f78b` |
| Runtime SHA-256 | `39159cb39eec8e687257dc9c604edab637df26787a522c4ceff4280cd891167b` |
| Behavior | Global order-count gate; **lacks** `assert_prepared_order_operation_identity` |
| Existing backup identity | `/home/cetechtraining/backups/cetech-pos-bridge-0.6.0-stg05-before-d0480d33-20260924T074530Z.tgz` (listing verified `2026-10-08T14:12Z`) |
| Fresh pre-install backup | **Required** — mint new tarball of current plugin dir immediately before cutover |

## Install / rollback window (proposed)

1. Confirm host is training (`WP_ENVIRONMENT_TYPE=staging`; blogname TRAINING) — STOP if production.
2. Mint fresh rollback tarball of installed `cetech-pos-bridge`.
3. Deploy exact zip / tree `fc8f2d05…` using the existing proven complete-generation cutover + FPM verification procedure (operator-held; do not rebuild diagnostic tooling; do not kill a busy PHP worker).
4. Verify loaded generation: main + runtime SHA-256 match table above; grep confirms `assert_prepared_order_operation_identity`; version header alone is insufficient.
5. Caps: connect/verify ≤ 5 minutes; if FPM/generation ambiguous → rollback to fresh tarball; no blind retry of commercial keys.
6. Rollback: restore fresh pre-install tarball; re-verify baseline hashes; **do not** re-GRANT TRUNCATE; **do not** delete journal/attention rows.

## Fixtures (filled vs open)

| Slot | Value |
| --- | --- |
| Product (Tracks A/B/D) | Woo `49111` / qty `1` / `_stock=4` / `_price=29` / manage_stock yes / backorders no — **VERIFIED** `2026-10-08T14:14Z` |
| Expected total | **GHS 29.00** advisory until fresh customer/context quote confirms |
| Track C | **Not ready** — need existing stock=1 fixture (read-only search) **or** explicit bounded reduce-49111-to-1 write scope **or** STOP Track C |
| Org / location / register / device / shift / cashier | **UNVERIFIED** — needs staff session on Preview/tester |
| Customer | Synthetic walk-in (`*.training.identity` / training.invalid policy) at execution |
| HPOS order fingerprint | `97` at `2026-10-08T14:20Z` — re-fingerprint immediately before tracks |

## Maximum effects by track

| Track | Max requests / effects | Timeout / retry |
| --- | --- | --- |
| **A — Cash** | **One** quote + **one** prepare + **one** cash + **one** finalize; order Δ **+1**; stock Δ **−1** only if finalize stock authorized | No blind new prepare/cash/finalize keys; on ambiguity → resolve / Needs attention |
| **B — Electronic TEST** | **One** Paystack **TEST** initialize/verify; same product/qty/total class; **new** reference only | No live keys; no reuse of R7 `pos_2f0b5a038deb47c68aa36a7b9551b098`; pending → wait/reconcile |
| **C — Concurrent stock** | **One** last-unit script (two qty-1) only after stock=1 fixture recorded | STOP on second reservation/oversell; no cleanup restock/refund without separate scope |
| **D — Response-loss** | **One** dropped prepare HTTP + resolve/remount; **shares Track A sale identity** | No second prepare key; no extra sale solely for recovery |

Recommended authorization if Track C fixture still missing: **A + D + (optional B)** now; **C** deferred.

## Uncertainty recovery (all authorized tracks)

- Keep original `transactionId` + prepare/cash/finalize keys.
- `SalesPort.resolve` / Needs attention; reconcile Woo order vs POS sale before any retry.
- **Forbidden:** new prepare key while unresolved; journal/attention deletion; wrong-generation fallback; production host; force-complete loser; casual restock/refund cleanup.

## Approval block (owner fill)

```text
decision: RD-02-LIVE-TX-QUAL
authorizer: ________________
utc: ________________
host: https://training.cetechbpa.com
bridge_install_authorized: NO / YES
artifact_sha: ab5c7e1f3849ff65100a84058e92f8b281a14be2
bridge_tree: fc8f2d05e7fe36001c3e9265cad0b4754417fedd
zip_sha256: e875ec3af476e230f2571624a3d0111dc29c1856d1793481deecfc1b6dbfa503
fresh_backup_path: ________________
tracks_authorized: [ ] A-cash  [ ] B-electronic-TEST  [ ] C-concurrent-stock  [ ] D-response-loss
track_c_fixture: stock=1 product id ________ / reduce-49111-to-1 / STOP
preview_under_test: dpl_8pUT6fhYPKxR6B7uFhoUVUx2ZYJL
caps_acknowledged: YES / NO
notes:
```

## Related

- `RUNTIME-QUALIFICATION-CONTINUATION-01.md`
- `QUALIFICATION-RD-DECISIONS.md`
- `RUNTIME-DECISIONS-MANIFEST.md` §2
- `LANE-B-LIVE-RUNTIME-PLAN.md`
