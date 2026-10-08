# Qualification RD decision sheet — PR #144

Status: **DECISION SHEET / OPERATOR PREP ONLY**  
Staff-documentation impact: **NONE**  
Production effects: **NONE**  
Verdict: **NOT READY FOR PRODUCTION**

This sheet makes RD-01 / RD-02 / RD-03 concrete for human authorization. Approving one section does **not** authorize the others. Fill authorizer + UTC before any side effects for that section.

Root-verified staging facts: `2026-10-08T15:02Z` + RD-01 apply (see `RUNTIME-DECISIONS-MANIFEST.md` §0).  
**Frozen qualification Preview:** tip `f0feb44…` → `dpl_8pUT6fhYPKxR6B7uFhoUVUx2ZYJL` READY — https://cetech-pos-staging-d299u3ex7-wbdevworlds-projects.vercel.app  
Product tip: `ab5c7e1…` / bridge tree `fc8f2d05…` (≡ freeze). Optional product Preview `dpl_CBSA…` at `acs2cuq3m` URL (not `pji89co71`).  
Observed Preview `BUILD_ID`: **`local-dev`** (binding gap). Tester remains `816e0bb…` / `dpl_nxWG…`.  
RD-01 **COMPLETE**. RD-02 request: `RD-02-EXECUTION-REQUEST.md`.  
Issues **#115** / **#132** remain **OPEN**. Profiler **PARKED**.

---

## RD-01 — Staging #143 apply (pinned migration only)

**Decision ID:** `RD-01-STAGING-TRUNCATE-REVOKE`  
**Status:** **COMPLETE — APPLIED AND VERIFIED** on staging `iegxncvpsyaitkpzywcr`  
**Receipt:** `RD-01-STAGING-EXECUTION-RECEIPT.md`  
**Do not re-apply.** Do not bulk-push mismatched historic timestamps.

### Exact artifact

| Field | Value |
| --- | --- |
| Shipping file | `supabase/migrations/20261006025100_db_sec_01_revoke_authenticated_truncate.sql` |
| PR / commit | `#143` / `c512b106bce1a0efcfd9c2caeddd54ad9e43dccd` |
| Blob | `6936b0e68a5bb3fbd4e08bd4b5f50b08d78bfef5` (1332 bytes) |
| Source version | `20261006025100` |
| Hosted version | `20261008151307` (`db_sec_01_revoke_authenticated_truncate`) |
| Hosted apply | **DONE** — one `apply_migration` success; no retry |
| Bulk pending apply | **FORBIDDEN** — still forbidden forever for this repair |

### Preflight (root-verified `2026-10-08T15:02Z`, before owner apply)

| Check | Result |
| --- | --- |
| Applied migrations count | **24** (pre-apply) → **25** (post-apply) |
| Latest applied (pre) | `20261003083357` |
| Source version `20261006025100` | Mapped to hosted `20261008151307` (API-generated timestamp) |
| Authenticated TRUNCATE on 11 named tables | **False** after apply (was True) |
| Anon / PUBLIC TRUNCATE | **False** (unchanged) |
| Authenticated SELECT + INSERT on all 11 | **True** (unchanged) |
| Row counts on all 11 | Identical before/after (see receipt) |

### Approval / execution (filled)

```text
decision: RD-01-STAGING-TRUNCATE-REVOKE
authorizer: owner (conversation 2026-10-08T15:07:56Z)
utc: before 2026-10-08T15:10:42.729037Z / after 2026-10-08T15:13:21.829384Z
staging_project: iegxncvpsyaitkpzywcr
scope: preflight + pinned hosted apply
hosted_ddl_authorized: YES (staging only; completed)
bulk_pending_forbidden: YES
notes: see RD-01-STAGING-EXECUTION-RECEIPT.md; production NOT authorized
```

### Rollback (still forward-only)

- **Forward only.** Do **not** GRANT TRUNCATE to `authenticated` / `anon` / `PUBLIC` to “undo.”
- App rollback does not reverse a successful revoke and must not invent a GRANT.

---

## RD-02 — Training bridge install + bounded live tracks

**Decision ID:** `RD-02-LIVE-TX-QUAL`  
**Host:** `https://training.cetechbpa.com` only  
**Does not authorize:** RD-01 DDL, RD-03 restore/alias, production, live Paystack (non-TEST), refund/restock

### Bridge install gate (prerequisite for race-fix tracks)

| Field | Value |
| --- | --- |
| Current installed (read-only `2026-10-08T14:14Z`) | `cetech-pos-bridge` **0.6.0-stg05** — still global order-count gate |
| Candidate product SHA / tree | `ab5c7e1…` / `fc8f2d05…` (identity prepare + refund hooks + tax init) |
| Artifact zip SHA-256 | `e875ec3af476e230f2571624a3d0111dc29c1856d1793481deecfc1b6dbfa503` |
| Install | **Separate authorization** — see filled `RD-02-EXECUTION-REQUEST.md` |
| Backup identity before install | Existing listing + **mint fresh** pre-install tarball (required) |

Without install, live tracks must either **STOP** or explicitly accept fail-closed risk on the old global order-count gate in the authorization note.

### Track caps (plan only until authorized)

| Track | Cap | Target / fixture |
| --- | --- | --- |
| A — Cash | **One** cash sale | Product **49111** qty **1**; expected **GHS 29.00** (2900); order Δ **+1**; stock Δ **−1** only if finalize stock effect is authorized |
| B — Electronic TEST | **One** Paystack **TEST** initialize/verify | Same product/qty/total class as A; **no** live keys; new reference only (do not reuse R7 `pos_2f0b5a038deb47c68aa36a7b9551b098`) |
| C — Concurrent stock | **One** last-unit contention script | See fixture note below — **49111 @ `_stock=4` cannot prove last-unit with two qty-1 prepares** |
| D — Response-loss / recovery | **One** dropped prepare HTTP + resolve/remount | Same register scope; **no** second prepare key; pairs with Track A identity |

### Track C fixture note (critical)

Root/training read: Woo product **49111** has `_manage_stock=yes`, **`_stock=4`**, `_backorders=no`.  
Two concurrent qty-1 prepares against stock 4 can both succeed → **does not prove last-unit / oversell protection**.

**Operator must choose one before Track C:**

1. **Preferred:** reduce/fingerprint a stock-managed simple product to **`_stock=1`** for the test window (record before/after); run two qty-1 prepares (POS vs POS or POS vs online) so exactly one winner commits and the loser fail-closes; restore stock only under explicit stock-edit authorization if needed for cleanup; **or**
2. **Alternate fixture:** identify another training stock-managed simple product already at `_stock=1` (publish, no backorders) and record id/SKU/`_stock`/`_price` before contention; **or**
3. **STOP** Track C — do not claim last-unit PASS from 49111@4 with two qty-1.

Do **not** substitute Lane B unit fixtures (`woo-global-order-count-concurrency.fixture.test.ts`) for live Track C PASS.

### Recovery (all tracks)

| On ambiguity | Explicit non-recovery |
| --- | --- |
| Keep original `transactionId` + prepare/cash/finalize keys; `SalesPort.resolve` / Needs attention; reconcile Woo order vs POS sale before retry | No new prepare key while unresolved; no journal/attention deletion; no production host; no force-complete loser; no manual stock edit to “clean” evidence |

### Approval block

```text
decision: RD-02-LIVE-TX-QUAL
authorizer: ________________
utc: ________________
host: https://training.cetechbpa.com
bridge_install_authorized: NO (default) / YES → artifact SHA ________
tracks_authorized: [ ] A-cash  [ ] B-electronic-TEST  [ ] C-concurrent-stock  [ ] D-response-loss
track_c_fixture: stock=1 product id ________ / reduce-49111-to-1 / STOP (circle)
caps_acknowledged: YES / NO
notes:
```

---

## RD-03 — Shared / paid / remote restore or release-switch only

**Decision ID:** `RD-03-DEVICE-PRINT-ROLLBACK`  
**Narrow approval rule for this sheet:** RD-03 human approval is required **only** for actions that touch **shared**, **paid**, or **remote** restore targets, or that **switch a release alias / shared tester**.

Local cashier device install, local printer/reprint rehearsal, and **isolated disposable** restore onto a non-shared clone (when already named and non-destructive to shared cashiers) may proceed under existing R10 runbook discipline **without** inventing a new production GO — but still must not move the tester alias or touch production.

### Needs explicit RD-03 approval

| Action | Why |
| --- | --- |
| Shared tester alias move / `VERCEL_STAGING_ALIAS` change | Shared release-switch |
| Promote Preview → shared staging / production | Release-switch |
| Restore onto shared training host used by other cashiers | Shared restore |
| Paid provider restore / remote Supabase restore on live staging `iegxncvpsyaitkpzywcr` | Paid/remote + shared staging risk |
| Any production backup/restore | Production |

### Does **not** need this RD-03 approval (still not production)

| Action | Note |
| --- | --- |
| Use frozen unpromoted Preview `dpl_8pUT6fhYPKxR6B7uFhoUVUx2ZYJL` (or optional `dpl_CBSA…`) | Already deployed automatically; not aliased |
| Installed-PWA / printer steps on a **dedicated** cashier device against Preview or current tester | Device evidence only; record BUILD_ID |
| Isolated disposable restore onto a **named non-shared** clone | Authorizer still names hostname/project; never overwrite shared staging cashiers “because convenient” |

### Exact pins (do not move without approval)

| Pin | Value |
| --- | --- |
| Shared tester BFF | `dpl_nxWGrSLqaLBGNNN683QjdixNBjF6` READY — `BUILD_ID` `816e0bb6963aff760609a3c7e4817e603c4ffdf0` |
| Frozen candidate Preview | `dpl_8pUT6fhYPKxR6B7uFhoUVUx2ZYJL` READY — tip `f0feb44…` — https://cetech-pos-staging-d299u3ex7-wbdevworlds-projects.vercel.app |
| App rollback known-good | Tester `816e0bb…` (code only; ≠ commerce reversal) |
| DB rollback | Never re-GRANT TRUNCATE |

### Approval block

```text
decision: RD-03-DEVICE-PRINT-ROLLBACK
authorizer: ________________
utc: ________________
scopes_authorized:
  [ ] shared-tester-alias-move
  [ ] paid-or-remote-restore
  [ ] shared-training-host-restore
  [ ] production-restore (MUST stay unchecked unless separate production authority)
isolated_clone_target: ________________  (or N/A)
notes:
```

---

## Cross-cutting blockers (still open)

| Blocker | State |
| --- | --- |
| Hosted #143 apply (RD-01) | **COMPLETE** — staging `20261008151307`; do not re-apply |
| Training bridge install of product tip `ab5c7e1` | RD-02 request ready (`RD-02-EXECUTION-REQUEST.md`); not installed |
| Track C last-unit fixture | 49111@stock=4 insufficient; need stock=1 fixture or reduce / STOP C |
| Org/location/register/shift session ids | UNVERIFIED — Preview sign-in Access denied / AUTH_REQUIRED without staff session |
| Preview BUILD_ID binding | Observed `local-dev` on `dpl_8pUT` / `dpl_CBSA` (gap vs git SHA) |
| Installed-PWA / physical printer | Desktop ≠ installed; device absent; UNVERIFIED |
| #115 / #132 | Remain OPEN |
| Profiler | PARKED |
| Production | **NOT READY FOR PRODUCTION** |

## Related

- `RD-01-STAGING-EXECUTION-RECEIPT.md` (RD-01 closed)
- `RD-02-EXECUTION-REQUEST.md` (owner decision)
- `RUNTIME-QUALIFICATION-CONTINUATION-01.md`
- `RUNTIME-DECISIONS-MANIFEST.md` (full preflight + track detail)
- `CANDIDATE-DEPLOYMENT-MANIFEST.md`
- `COMBINED-CANDIDATE.md`
- `HANDOFF-R144-QUALIFICATION.md`
- `LANE-B-LIVE-RUNTIME-PLAN.md`
