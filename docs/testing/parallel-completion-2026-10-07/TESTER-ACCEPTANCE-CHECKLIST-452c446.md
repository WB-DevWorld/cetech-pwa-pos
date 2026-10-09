# Tester acceptance checklist — Preview `452c446`

Candidate URL (only this build for 09:00 testing):  
https://cetech-pos-staging-srx2grakx-wbdevworlds-projects.vercel.app  

Deployment: `dpl_F3uXpLZA7xrkTb5av4TNzDc3ZGry` · BUILD_ID / Git SHA `452c446fd0e3821fc3bfdb5de85a01d19a331809`  
Retain f0 and shared tester aliases — do **not** treat them as this candidate.  
Staff-documentation impact: **NONE** for checklist issuance.  
Classification: items below are **TESTER ACCEPTANCE PENDING** until recorded — not Cursor hardware blockers for software handoff.

Record for every check: date/time (UTC), tester name, device model, OS, browser (or installed PWA), observed BUILD_ID, pass/fail/blocked, notes. Do **not** clear IndexedDB, journals, or unresolved operation evidence as a routine cache fix (see `docs/runbooks/R10-DEVICE-AND-PWA-REHEARSAL.md`).

## A. Cache / installed PWA / device (tester-owned)

| ID | Check | Result |
| --- | --- | --- |
| T-A1 | Install / open installed PWA on CETECH Windows POS device; confirm BUILD_ID `452c446…` | PENDING |
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

## D. Software already assigned to Cursor (do not re-fail as “missing hardware”)

Cursor verifies on the authenticated candidate: local barcode/SKU/name search, cart mutation, draft persistence, sign-out/re-sign-in, offline local search, truthful Pay disablement, reconnect, existing-receipt Orders Reprint without checkout/shift. Results land in the consolidated 08:55 handoff — not in this tester table.

## Forbidden during acceptance

- No production cutover claim from this checklist alone  
- No second cash A+D sale; no RD-01 re-apply; no shared alias move  
- No live Paystack charge unless a separate exact B GO is recorded  
- No clearing storage to “fix” cache issues  
