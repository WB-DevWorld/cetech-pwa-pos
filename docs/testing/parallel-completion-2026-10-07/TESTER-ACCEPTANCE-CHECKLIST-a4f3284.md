# Tester acceptance checklist — Preview `a4f3284`

Candidate URL (only this build for current testing):  
https://cetech-pos-staging-q2u9baevb-wbdevworlds-projects.vercel.app  

Deployment: `dpl_FAaW712WnVBZ9Wr7B8MXCurJEeXW` · BUILD_ID / Git SHA `a4f3284c35785dbb0efe3843d38084f12911ac15`  

**Supersedes for testing:** `452c446` / `dpl_F3uXp…` / `srx2grakx` (retained, not deleted).  
Retain f0 (`dpl_4Vk3XQ…`) and shared tester (`816e0bb…` / `git-integration-9578df…`) — do **not** treat them as this candidate. Do **not** silently move shared aliases.

Staging schema: tender-claim + write-boundary + evidence enrollment applied (`20261009214234`…`20261009214238`).  
Training bridge runtime: `fa478ea4…` · native FPM proof of prepare same-request delete guard **PASSED** (current execution; not historical cutover).  
Staff-documentation impact: entrypoints updated for this round (see staff README / brief / guide / workbook).  
Classification: device/PWA/scanner/paper items remain **TESTER ACCEPTANCE PENDING**.  
Verdict: **NOT READY FOR PRODUCTION**.

Evidence publish (docs only): PR #144 includes checklist + `A4-REMAINING-QUALIFICATION-01-RESULTS.md` at `8d8fe1010f18252af48b14af4a6eed3b4802b237` (product freeze unchanged). Software T-D3b / T-D4c / T-D4d rows below are capture-backed; journal remains NOT EXERCISED; §A–C remain tester-owned.

Record for every check: date/time (UTC), tester name, device model, OS, browser (or installed PWA), observed BUILD_ID, pass/fail/blocked, notes. Do **not** clear IndexedDB, journals, or unresolved operation evidence as a routine cache fix (see `docs/runbooks/R10-DEVICE-AND-PWA-REHEARSAL.md`). Do **not** click Pay or create a new commercial fixture.

## A. Cache / installed PWA / device (tester-owned)

| ID | Check | Result |
| --- | --- | --- |
| T-A1 | Install / open installed PWA on CETECH Windows POS device; confirm BUILD_ID `a4f3284…` | PENDING |
| T-A2 | One supported mobile/PWA path; model/OS/browser/build recorded | PENDING |
| T-A3 | Controlled update discovery / activation rules with protected cart or durable marker (no live Pay) | PENDING |
| T-A4 | Multi-tab leadership / no silent reload clearing drafts | PENDING |
| T-A5 | Offline → reconnect preserves local drafts; no manufactured unresolved journal entries | PENDING |

## B. Scanner (tester-owned)

| ID | Check | Result |
| --- | --- | --- |
| T-B1 | Keyboard-wedge focus on Sell search | PENDING |
| T-B2 | Known barcode → product; repeat scan behavior | PENDING |
| T-B3 | Unknown barcode → truthful failure (no crash) | PENDING |

## C. Printer / paper (tester-owned)

| ID | Check | Result |
| --- | --- | --- |
| T-C1 | Physical reprint of existing order **50317** / receipt `rcpt-33326bbc` / **GHS 29** | PENDING |
| T-C2 | Width / readability on live paper | PENDING |
| T-C3 | Browser print dialog alone is software evidence only — paper is this section | PENDING |

## D. Software / operator (noncommercial on this URL)

| ID | Check | Result |
| --- | --- | --- |
| T-D1 | Staff sign-in on immutable candidate URL (private; no passwords in chat) | **PASSED** (operator; Staging Manager) |
| T-D2 | Session / register / shift hydration | **PASSED** software — session 200; registers listed; no shift opened |
| T-D3a | Catalog presentation on Sell | **PASSED** — product grid loaded; Pay stayed disabled; no Pay/sale |
| T-D3b | Exact-build draft persistence / journal survival | **PASSED** software — disposable cartId `92c31c92…` rev1 survived reload + offline/online; cleared after; journal count 0 = **NOT EXERCISED** for unresolved recovery (`2026-10-10T02:09Z`) |
| T-D4a | Order **50317** detail + receipt retrieval (GHS 29 / `rcpt-33326bbc`) | **PASSED** software — UI detail + `GET /api/pos/v1/receipts/33326bbc…` |
| T-D4b | No-scope Reprint control (no register / no open shift) | **PASSED** software — Reprint available and clicked once |
| T-D4c | Receipt reload observation | **PASSED** software — reopen 50317 + receipt reload `rcpt-33326bbc` / GHS 29 / SKU 49111 unchanged (`2026-10-10T02:10Z`) |
| T-D4d | Native browser print dialog / paper | **PASSED** software — Reprint mounted receipt paper and invoked `window.print`; **paper remains §C tester** |
| T-D5 | Confirm release-policy / UI show BUILD_ID `a4f3284…` | **PASSED** |

## Related

- Execution receipt: `STAGING-ROLLOUT-A4F3284-EXECUTION-RECEIPT.md`
- Prior checklist (superseded for current testing): `TESTER-ACCEPTANCE-CHECKLIST-452c446.md`
