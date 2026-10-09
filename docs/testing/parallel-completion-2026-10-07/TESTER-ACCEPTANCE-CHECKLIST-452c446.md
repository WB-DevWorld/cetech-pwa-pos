# Tester acceptance checklist — build 452c446

**9 October 2026. [Read the current Test Brief](../../staff/TEST-BRIEF-2026-10-09.md).**

**Only testing URL:** https://cetech-pos-staging-srx2grakx-wbdevworlds-projects.vercel.app

**Existing receipt:** order 50317 / POS-50317 / GHS 29.00. Sign in with your own authorized account. No register assignment or open shift should be needed to reprint. Do not alter an existing shift to test this.

| Check | Expected observation | Result / evidence |
| --- | --- | --- |
| Private sign-in | Your authorized account opens permitted areas; wrong roles remain blocked | NOT RUN — fill |
| Current launch | Browser/installed POS opens this address and build, not an earlier install | NOT RUN — fill |
| Name/SKU lookup | Correct product appears; record response time | NOT RUN — fill |
| Barcode | Exact item; repeated scan adds another unit; rapid scans retain each item; choices remain correct | NOT RUN — fill |
| Safe draft cart | Add, quantity change and remove work; correct customer; record price-ready delay | NOT RUN — fill |
| Existing order | 50317 and GHS 29.00 match the stored receipt | NOT RUN — fill |
| Reprint without working register/shift | Reprint is available to permitted staff; no new commercial operation | NOT RUN — fill |
| Browser print preview | Receipt, readable lines/totals and appropriate paper layout | NOT RUN — fill |
| Actual paper | Correct printer, 58/80 mm where applicable, legible top-aligned output | NOT RUN — fill |
| Computer/tablet/phone | Usable controls and dialogs; no hidden critical actions | NOT RUN — fill |
| Installed POS/cache | Correct launch/build after close/reopen; update behavior recorded; saved work preserved | NOT RUN — fill |
| Offline/reconnect | Safe local draft survives; local actions usable; payment blocked offline; reconnect keeps draft | NOT RUN — fill |

For each attempted check use PASS / FAIL / PARTLY WORKED / COULD NOT TEST. Leave unattempted rows NOT RUN. Record tester, date/time, role, location, browser/installed POS and equipment. Attach screenshots or paper photos with filenames. A print dialog is not proof of physical printing.

**Permitted now:** private sign-in, browse/search, safe draft/price checks, viewing existing orders and reprinting the agreed receipt, device/offline exercises that preserve safe local work.

**Separate GO required:** new checkout/payment, refund, stock/concurrency test, Attention repair, shift changes, shared account/configuration changes. Completed cash/recovery and the staging privilege repair are not repeated. Do not use production customers or money.

Do not clear cookies/site data, discard unresolved work or manufacture a service outage. Do not share passwords or database credentials. Staff record symptoms; engineering owns database access/restore and unresolved backend investigations.

All rows begin unmarked because this update does not establish private authenticated acceptance on the new Preview or actual tester hardware acceptance. Earlier-build results are retained separately. Production acceptance remains incomplete.
