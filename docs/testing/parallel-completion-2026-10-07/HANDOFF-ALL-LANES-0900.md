# HANDOFF — All-lanes execution to 09:00 UTC (freeze)

Freeze time: **2026-10-09T08:45Z** (target ≤08:55)  
Acting: `@wbdevworld` / WS3  
Owner Preview approval: **GRANTED** `2026-10-09T07:53:29Z` (empty origins + missing independent-review exception for this Preview only)  
COMMENT review `5467420094` on `452c446…` = owner acceptance, **not** independent APPROVED  
Staff-documentation impact: **NONE**  
Production effects: **NONE**

---

## 1. One verified testing URL

| Field | Value |
| --- | --- |
| **URL** | https://cetech-pos-staging-srx2grakx-wbdevworlds-projects.vercel.app |
| Deployment | `dpl_F3uXpLZA7xrkTb5av4TNzDc3ZGry` |
| Application / BUILD_ID / Git SHA | `452c446fd0e3821fc3bfdb5de85a01d19a331809` |
| Product composition | still `542d3ef2f862394a762de43eacf00c724b17aaec` (Reprint ports unchanged) |
| Target | Preview (immutable); shared tester **not** moved (`816e0bb…`); f0 retained (`f0feb44…`) |
| Origin admission | Sign-in UI visible; `GET /api/pos/v1/session` → **401 AUTH_REQUIRED** (not FORBIDDEN) |
| Release policy | `latestBuild`/`recommendedBuild`/`minimumSupportedBuild` = `452c446…` |
| Installed bridge (training host; unchanged this window) | prior complete install identity `63094753…` / `89e4461c…` — FPM cutover still **UNVERIFIED** |
| Staging migration identity | RD-01 hosted `20261008151307` ↔ source `20261006025100` — **do not re-apply** |

Receipt: `PREVIEW-452c446-DEPLOY-RECEIPT.md`

---

## 2. What testers can do on this build

- Sign in on the URL above (staff account; private).  
- Sell: search/cart/draft (software).  
- **Orders → Reprint** existing **50317** / `rcpt-33326bbc` / **GHS 29** without requiring checkout or an open shift (product fix on this SHA).  
- Use checklist `TESTER-ACCEPTANCE-CHECKLIST-452c446.md` for cache/PWA/device/scanner/paper — **TESTER ACCEPTANCE PENDING**, not Cursor hardware blockers for software handoff.

Do **not** use f0 or shared-tester URLs as this candidate. Do **not** clear IndexedDB/journals as routine cache remedy. No second cash sale. No production cutover from this handoff.

---

## 3. Completed software / recovery proof + tester-owned pending

| Track | Status |
| --- | --- |
| Preview deploy + BUILD_ID + origin | **PASSED** |
| Authenticated Orders Reprint on candidate URL | **PENDING operator private sign-in** on Preview (f0 remains separately signed-in; cross-origin session does not transfer) |
| Lane2 browser software (search/cart/draft/offline/Pay disable) on candidate | **PENDING** same sign-in |
| Automated PWA/update/multi-tab (prior) | carry forward; installed-device = tester |
| Tester cache/PWA/scanner/printer | **TESTER ACCEPTANCE PENDING** — checklist issued |
| Woo SQL restore | **ACCEPTED** (prior) |
| Woo application boot + RO checks | **PASSED** — `LANE3-WOO-APP-BOOT-01.md` (50317 processing GHS29; stocks 3/1) |
| POS DB dump/restore | **BLOCKED** — no DB URI on workstation — `LANE4-POS-DB-RECOVERY-01.md` |
| B/C commercial | **NOT EXECUTED** — decision sheet `LANE5-BC-COMMERCIAL-DECISION-452c446.md` |

---

## 4. Performance / open issues

- `#115` / `#132` remain **OPEN** — not closed from HTTP/CI.  
- No new p95/p99; quote-only samples not re-run this freeze window.  
- Prior 6–7s REST init bracket still does not name an exclusive culprit.

---

## 5. Remaining critical blockers / owners / rollback

| Blocker | Owner / action | Rollback |
| --- | --- | --- |
| Authenticated candidate checks | Operator signs in privately on Preview URL (password never in chat) | Retain f0 |
| POS staging dump | Place Direct/Session pooler URI only in `%LOCALAPPDATA%\CETECH-POS-R10\private\staging-db.url` | Leave empty PG |
| B GO (optional) | Separate exact senior GO — sheet ready | No charge |
| Tester device/PWA/scanner/paper | Testers complete checklist | N/A |
| Independent APPROVED / merge / prod | Human governance — not granted by owner Preview exception | Keep Preview unpromoted |
| FPM cutover history | Remains **UNVERIFIED** — do not kill PHP for retrospective proof | — |

---

## 6. Production verdict

**NOT READY FOR PRODUCTION**

Software candidate `452c446` / `dpl_F3uXp…` is issued for **tester acceptance**. Pending tester-owned device checks, POS restore, authenticated Reprint confirmation on this URL, B/C authorization, independent review/merge gates, and FPM cutover proof keep production cutover closed. RD-01 and cash A+D remain closed; exactly-once sale evidence preserved.
