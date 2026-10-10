# A4-REMAINING-QUALIFICATION-01 — consolidated results

Task: `A4-REMAINING-QUALIFICATION-01` · `@wbdevworld` / WS3 (Cursor)  
Product freeze: `a4f3284c35785dbb0efe3843d38084f12911ac15`  
Accepted closeout baseline: `033463ec5ef5f2aa580a7c3c412251bcfacab396`  
Preview: `dpl_FAaW712WnVBZ9Wr7B8MXCurJEeXW` / https://cetech-pos-staging-q2u9baevb-wbdevworlds-projects.vercel.app  
Staging: `iegxncvpsyaitkpzywcr` · Training: `training.cetechbpa.com`  
UTC window: `2026-10-10T02:07Z`–`02:17Z`  
Staff-documentation impact: **NONE** (no staff entrypoint or procedure change this task)  
Production effects: **NONE** · Verdict: **NOT READY FOR PRODUCTION**

## Results table

| Gate | Environment / build | Evidence | Result | Remaining dependency |
| --- | --- | --- | --- | --- |
| Migrations / schema (prior) | hosted `20261009214234`…`38` | prior receipt | **CLOSED** | none for this task |
| Bridge / FPM guard (prior) | `fa478ea4…` · native FPM | prior closeout | **CLOSED** | none for this task |
| Preview candidate (prior) | `dpl_FAaW712…` / `q2u9baevb` | prior receipt | **CLOSED** | none for this task |
| Lane1 T-D3b draft persistence | same Preview | disposable cartId `92c31c92-6fdd-407c-8f30-7b252dbf8e44` rev1 · SKU 49165 · survived reload + offline/online · cleared after | **PASS** (software) | — |
| Lane1 journal unresolved recovery | IndexedDB `journal` count **0** | read-only inspect | **NOT EXERCISED** | real unresolved journal artifact |
| Lane1 T-D4c receipt reload | order **50317** / txn `33326bbc-1dd7-4582-8409-ea434942d8db` | UI reopen + `GET /api/pos/v1/receipts/…` → `rcpt-33326bbc` · GHS 29.00 · SKU 49111 frozen | **PASS** (software) | — |
| Lane1 T-D4d native print dialog | Reprint on 50317 | receipt paper mounted; `window.print` invoked | **PASS** (software dialog only) | physical paper = tester §C |
| Lane2 backup/restore | Management API + empty `backups:[]` | `LANE2-POS-BACKUP-RESTORE-A4F3284.md` | **BLOCKED / OPEN** | downloadable restorable export **or** private Direct URI |
| Lane3 timings waterfall | Register/Sell warm | `LANE3-TIMINGS-QUOTES-A4F3284.md` | **PASS** (recorded) | #115/#132 still open |
| Lane3 ≤3 quotes | 14985×1 B2B cust4 `loc_a1` | median **10107** ms · bridge ~8.8 s · GHS 3000 | **PASS** (diagnostic) | does not close #132 |
| Lane4 commercial decision | read-only sheet | `LANE4-BC-COMMERCIAL-DECISION-A4F3284.md` | **PASS** (sheet only) | separate Cash/B/C GO |
| Device / PWA / scanner / paper | CETECH POS hardware | checklist §A–C | **TESTER PENDING** | tester-owned |
| Production qualification | — | commercial + restore + perf + device | **NOT READY** | evidence above |

## Tester URL (current)

https://cetech-pos-staging-q2u9baevb-wbdevworlds-projects.vercel.app

## Tester-owned remaining

- Installed PWA / BUILD_ID on device (T-A*)
- Scanner wedge (T-B*)
- Physical reprint paper of 50317 (T-C*)

## Related artifacts

- `LANE2-POS-BACKUP-RESTORE-A4F3284.md`
- `LANE3-TIMINGS-QUOTES-A4F3284.md`
- `LANE4-BC-COMMERCIAL-DECISION-A4F3284.md`
- `TESTER-ACCEPTANCE-CHECKLIST-a4f3284.md` (software rows updated)
- Historical B/C pin: `LANE5-BC-COMMERCIAL-DECISION-452c446.md`
