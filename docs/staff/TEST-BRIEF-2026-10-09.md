# CETECH POS — Staff Test Brief

**Issued:** 9 October 2026  
**Test build:** 452c446  
**Status:** Available for controlled staff testing. Production acceptance is incomplete.

## Use only this POS

**[Open CETECH POS for this round](https://cetech-pos-staging-srx2grakx-wbdevworlds-projects.vercel.app)**

Start from this link when opening or installing the POS. An older bookmark or installed POS may open a different website and build. Preserve saved work at older addresses; it does not automatically transfer to this address. Do not clear browser data or uninstall an older POS containing unfinished work. Report that work to the coordinator before switching.

Read the [Training Guide](STAFF-TRAINING-GUIDE.md), then use the [Testing Workbook](STAFF-TESTING-ACCEPTANCE-WORKBOOK.md) or the [short acceptance checklist](../testing/parallel-completion-2026-10-07/TESTER-ACCEPTANCE-CHECKLIST-452c446.md). This brief controls which checks are permitted now.

## Start here

1. Sign in with your own staff account. Keep passwords private.
2. Confirm you can open Sell and Orders. If access fails, record the address, message and any Reference line. Do not ask everyone to use Admin.
3. Search, scan and edit a safe draft cart. Record the products, quantities and customer. Opening Sell or changing a cart may check its price; a price check does not complete a sale.
4. Open Orders and find **50317**, receipt **POS-50317**, total **GHS 29.00**.
5. Open that order and select **Reprint**. An authorized existing-receipt reprint should work without assigning a register or opening a shift. Do not close an existing shift to manufacture that condition.
6. Check browser print preview, then print on the actual printer if available. Record those as separate results.
7. Run the device, installed-POS, scanner, cache/update and offline checks below. Do not press Pay for this round's acceptance checks.

Private sign-in and authenticated checks on this exact build have not yet been established in the handoff. Your results must record what actually works; the deployment being ready does not pre-mark these checks PASS.

## Checks testers own

| Check | What to record |
| --- | --- |
| Computer, tablet and phone | Screen size, browser, readable controls, dialogs and any overlap |
| Scanner | Exact product found, two identical scans give two units, rapid distinct scans are retained, variation choices remain correct |
| Prices and cart | Search/cart feedback, time until Price ready, quantity/customer changes, errors or stalled checks |
| Existing receipt | Order 50317 / GHS 29.00, Reprint availability, preview and actual paper output |
| Installed POS and cache/update | Launch address, whether the current build opens, close/reopen, update notices; preserve drafts and unfinished work |
| Offline and reconnect | Start online with a safe draft, disconnect, search/edit locally, reload/reopen where supported, reconnect; cart remains and payment stays blocked offline |

Use only a safe local draft for reload, sign-out or offline exercises. Stop if it contains an unfinished sale, payment or return. Do not disable shared services, change staff assignments, alter prices/stock, or clear saved data for these checks. A missing printer or scanner is **COULD NOT TEST**, not PASS.

## Payment, order and stock limits

This brief permits sign-in, browsing, draft-cart/price checks and existing-receipt reprint. It does **not** authorize a new checkout, cash/electronic payment, refund, stock change, Attention repair or shift open/close. Workbook steps requiring these actions stay unattempted unless the coordinator supplies a separately authorized fixture and cap.

The completed cash/recovery qualification must not be repeated. Order 50317 is for viewing and reprinting; do not cancel, refund or amend it. The remaining electronic/stock concurrency tracks have not received GO. Seeing a method or button does not grant permission.

If a sale/payment/refund is uncertain, stop repeating the action, preserve the same work and report it. If printing fails, report the print problem; do not create another sale.

## Record and submit

Make your own workbook copy. Record your name, date/time, device/browser or installed POS, role, exact address, build 452c446, chosen tests and any starting limitations. For each test use **PASS / FAIL / PARTLY WORKED / COULD NOT TEST**. Leave unattempted tests unmarked and state why.

Attach screenshots/photos and their exact filenames. Capture visible messages and how long a slow action took. Never include passwords, session cookies or private invitation links.

Submit the completed workbook and all referenced images to the test coordinator. Cache/device/scanner/printer results belong to the testers; database credentials and backup execution belong to the engineering/operator team. Staff do not need to collect or share database passwords.

## What is complete and what remains

| Complete or reported complete | Still pending |
| --- | --- |
| Exact Preview is READY; deployment record confirms source 452c446 | Private sign-in and authenticated software checks on this exact Preview |
| Prior controlled cash/recovery sale and receipt exist | Tester acceptance on actual installed POS, scanner and printer |
| Staging privilege repair already applied and verified | POS database backup/restore; engineering/operator access discovery |
| Isolated Woo application restore/boot reported passed | Independent review, FPM cutover identity, remaining authorized commercial gates and production GO |

The price-delay investigations remain open. Measure waits; do not assume that this deployment has fixed them. Production verdict remains **NOT READY FOR PRODUCTION**.

<details>
<summary><strong>Build record — coordinator/support</strong></summary>

- Exact source and reported BUILD_ID: `452c446fd0e3821fc3bfdb5de85a01d19a331809`.
- Deployment: `dpl_F3uXpLZA7xrkTb5av4TNzDc3ZGry`; Vercel metadata independently confirmed READY and the exact source SHA on 9 October.
- URL: `https://cetech-pos-staging-srx2grakx-wbdevworlds-projects.vercel.app`.
- Same-origin anonymous result: AUTH_REQUIRED, not FORBIDDEN, per execution handoff. It is not an authenticated acceptance result.
- Preview approval: owner-granted exact-Preview review exception and empty origins; no production promotion or merge approval is implied.
- Earlier shared tester and f0 Preview remain retained. They are not this round's target.
- Prior cash/recovery evidence is from a different application/bridge combination; do not inherit its acceptance onto this build.
- Woo restore/boot result is user-reported from the operator handoff; this documentation update did not rerun it.
- Issues #115 and #132 remain open. No new commercial effect or runtime change was performed by this documentation update.

If the deployed build changes, stop and have the coordinator issue a new brief. Do not mix results from different builds.

</details>
