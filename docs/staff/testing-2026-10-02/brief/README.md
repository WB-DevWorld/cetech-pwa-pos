# CETECH POS — Staff Test Brief

**Issued:** 2 October 2026\
**Updated:** 2 October 2026 — approved price-check update is live\
**Use:** The next staff-testing round. Each tester records their actual test date.

## Open this POS

**[Open the POS for this testing round](https://cetech-pos-staging-git-integration-9578df-wbdevworlds-projects.vercel.app)**

Use this link every time, including when installing the POS on your phone or computer. Start from this brief instead of an old message or bookmark.

If your installed POS already opens from this address and works, keep using it. Keep your saved cart and unfinished work.

If a different POS address shows **Access denied** even with your correct password, open the link above. If it still fails, record the address, the message, and any Reference line for the administrator.

The approved price-check update is now on this same POS link. **Version for this round: 2c7eb2d.** Results from the earlier version should be kept separate.

Sampled live server price checks took about 9–31 seconds. That is still slow, so the investigation continues. Do not mark a slow price check PASS just because it eventually finishes.

Keep using the same POS address above. Refresh the browser page, or close and reopen the installed POS. If the POS offers an update, follow its instructions once your work is safe. Keep your saved cart and unfinished work. Do not clear browser data.

Record how long the price takes to appear in **T23 and T30**. If **Check price again** appears, select it once. If the price is still unavailable, report the time and message and continue another module. Do not make up a total or repeat a sale.

Some checks still need your results before we can decide whether the POS is ready for normal customer use.

The [24 September brief](https://github.com/WB-DevWorld/cetech-pwa-pos/tree/docs/staff-test-readable-2026-10-02/docs/staff/testing-2026-10-02/history) is an old record. **Do not use its POS link for this round.**

## How the team will work

One person will be the **test administrator**. The owner gives that person the existing Admin role. That person sets up the team and mainly tests the Management screens.

The other testers use their own **Cashier accounts**. Each tester gets a separate register so they can work independently. Two accounts on the same register cannot each open a separate shift at the same time.

The administrator may also test selling. To do that, they need a Cashier or Manager role at the test location and their own assigned register. Admin access alone does not give every selling, shift-close, or return-approval permission.

The owner still controls the final decision about using the POS for normal business.

## Administrator: set up the team first

Use [Management in the Training Guide](https://github.com/WB-DevWorld/cetech-pwa-pos/tree/docs/staff-test-readable-2026-10-02/docs/staff/testing-2026-10-02/training#27-staff--access) and **Module M00** in the [Testing Workbook](https://github.com/WB-DevWorld/cetech-pwa-pos/tree/docs/staff-test-readable-2026-10-02/docs/staff/testing-2026-10-02/workbook#m00--team-setup-and-management).

1. Sign in with your Admin account. Check that Management opens.
2. Choose an active test location. Add a test location only if one is needed and the owner has directed you to do so.
3. In **Management → Registers**, create a separate test register for each tester, using the agreed names and GHS. Give yourself another register if you will also test selling.
4. In **Management → Devices**, make sure there is an active POS device at each chosen location. Record the device each tester should select. Separate registers provide separate shifts. A separate device entry per tester may help keep the setup clear, but it is not a substitute for separate registers.
5. In **Management → Staff & access**, create each needed staff account. Give ordinary testers the **Cashier** role at the correct location, assign their register, and enable POS access after setup succeeds. Existing accounts may be used if their roles and assignments are correct.
6. For **Create account now**, give each person their temporary password privately. They change it at first sign-in. For **Send invitation**, the person uses the account-setup email; their location/register assignments and POS access still need to be complete.
7. Keep at least one Cashier-only account free of Owner, Admin, and Support roles. Use it for the cashier access checks. Use separate agreed accounts for Manager/Support/Owner checks where available.
8. Check **Shifts & cash** before handing out a register. Do not close somebody else's existing shift to free it. Create a fresh test register or agree on a safe handover.
9. Each tester signs in and checks their own Register screen. They open their own shift when their chosen tests need it. If access or setup fails, record it and fix the assignment through Management. Do not give everyone Admin to make Register appear.
10. Check whether Cashiers are allowed to close their own shifts. If they are not, record who will help with the close tests. Any return-approval helper needs the Manager role at that location.

Record setup results under **T131/T132** for accounts and **T136** for locations, registers, and devices. Setup is part of testing, so record what went wrong as well as what worked.

### Team setup record

Fill this in your working copy. These rows describe the intended setup; they are not proof that accounts or registers already exist.

| Person | Main work | Location role | Their own register | Location / active device | Sign-in and Register checked? |
| --- | --- | --- | --- | --- | --- |
| Administrator — name to fill | Team setup and Management | Cashier or Manager if also selling | To fill if also selling | To fill | To fill |
| Tester A — name to fill | Selected cashier modules | Cashier | To fill | To fill | To fill |
| Tester B — name to fill | Selected cashier modules | Cashier | To fill | To fill | To fill |
| Tester C — name to fill | Selected cashier modules | Cashier | To fill | To fill | To fill |

Add rows for more testers. Keep passwords and invitation links out of this document and screenshots. Keep personal account details in the team's private working copy.

### Existing registers need a fresh check

The pre-test check reported six active registers. Register A, B2 Register, and QA Test Register already had open shifts. `reg_b` was at a location without an active device. These conditions may have changed.

Check them again before using them. A fresh test register is often easier than taking over an existing shift.

## Choose the tests you want to do

Read the [Training Guide](https://github.com/WB-DevWorld/cetech-pwa-pos/tree/docs/staff-test-readable-2026-10-02/docs/staff/testing-2026-10-02/training), then make your own copy of the [Testing Workbook](https://github.com/WB-DevWorld/cetech-pwa-pos/tree/docs/staff-test-readable-2026-10-02/docs/staff/testing-2026-10-02/workbook).

Choose modules from the menu at the front. You do not have to start at T01 or wait for everyone else. You can choose the same module as another tester if you each use your own register and test records.

Follow the steps inside your chosen module in order where the steps depend on each other. For example, a receipt needs a completed sale, and the offline test starts online before you disconnect.

Coordinate only when you deliberately share an order, return, account, browser profile, receipt setting, or other setting. Do not change another tester's setup while they are using it.

## Payment and return rules for this round

- Use the test POS and agreed training products/customers only.
- **Cash is the payment method for ordinary testing.** Treat amounts as test cash, not a real customer payment.
- Do not use Mobile Money, card, payment links, or another electronic method just because it appears. T50/T51 stay **COULD NOT TEST — not enabled for this round** unless the owner separately authorizes a specific payment test.
- Return tests use a fresh eligible test order that belongs to you, or one explicitly handed to you for that test. Do not return another tester's order.
- The old refund case under **issue #102**, including order **49816**, is protected. Do not refund, retry, reconcile, restock, or use it as a normal return test. T82 needs a different agreed safe case.
- If a payment, sale, refund, or stock result is uncertain, stop repeating that action. Record what happened. Continue unrelated tests only when safe.
- If printing fails, try the receipt/reprint checks. Do not repeat the sale to get another receipt.
- Do not clear cookies, browser data, or saved POS work to repair a problem.

## Checks that especially need your evidence

| What to prove | Where to record it |
| --- | --- |
| Cashier-only sign-in and Register access, without Admin | T01, T13 |
| A fresh cash sale reaches its first receipt without interruption | T40, T60, T61. Then use T62 to reprint that same receipt. |
| Installed POS closes and reopens without internet, keeps the cart, then reconnects safely | T100–T104, in order, on the installed POS |
| An out-of-date product list becomes ready after Refresh | T25. If the starting condition is not available, say COULD NOT TEST. |
| One person leaves unfinished work, then another signs into the same browser without taking over that person's work | T92, with two agreed testers and a safe unfinished test case |
| New staff can set up their account and reach their assigned register | T131/T132 with T03/T13 |
| Management works clearly on available computers, tablets, and phones | T130–T139 with T140–T142 |

The deliberate service-failure check (**T05 / issue #86**) needs a developer's controlled test setup. Ordinary staff should not break or change services to make it happen.

The slow-service investigation under **issue #115** continues separately. If something is slow, record the time, screen, action, message, and whether it eventually worked. Staff do not need to diagnose the cause.

## Record and submit your results

For each test, choose **PASS / FAIL / PARTLY WORKED / COULD NOT TEST**. Record what you did, what you expected, and what actually happened. Do not mark a blocked or unattempted test PASS.

Take a screenshot or photo when it helps explain the result. Either add the image to your Markdown workbook or write its exact filename/path in the result. Include visible messages. Never include passwords or private invitation links.

At the end, submit:

1. your completed workbook, including the modules you chose and any tests you could not finish; and
2. every screenshot/photo file referenced in it.

Use your actual test date in names such as `POS-Test-Results-Ama-YYYY-MM-DD.md` and `POS-Test-Screenshots-Ama-YYYY-MM-DD/T60-first-receipt-01.png`. Keep filenames unchanged after referencing them.

You do not need the owner to sit with you. Your completed workbook and evidence should explain what happened clearly enough for someone else to review it later.

<details>
<summary><strong>Build and qualification record — for the review team</strong></summary>

- Current application SHA: `2c7eb2ddeb22c3402d82673421a54dbe6ad236f1`, [PR #133](https://github.com/WB-DevWorld/cetech-pwa-pos/pull/133), branch `ws3/quote-latency-2026-10-02`.
- CI: [#1476 / run 37034917235](https://github.com/WB-DevWorld/cetech-pwa-pos/actions/runs/37034917235), SUCCESS on Linux and Windows; 1,418 unit tests and 26 browser tests passed.
- Independent review: Ben-001-sys approved this exact head on 2 October 2026 at 16:52:18 UTC. The owner authorized deployment and keeping the same tester link.
- Current Vercel deployment: `dpl_7uJ7TEMenmjpc3BpTFAEzgH7a5Zg`; READY at 17:08:05 UTC; Preview. `BUILD_ID` is scoped to this Preview branch and equals the application SHA above.
- Accepted test URL: `https://cetech-pos-staging-git-integration-9578df-wbdevworlds-projects.vercel.app/`. On 2 October 2026, the address resolved to the deployment above; its HTTP 200 page carried the exact application SHA as `appBuild`.
- The tester domain is connected to Preview branch `ws3/quote-latency-2026-10-02`. Keep that branch at the approved SHA. These documentation updates are published on a separate reading branch and do not move the application build.
- Live timing at 17:15:29 UTC: an authenticated quote succeeded with HTTP 200 in 29,733 ms; the WordPress bridge wait was 28,159 ms. Reference `954d1875-333a-4adb-b1c2-5b4374925b03`. This proves one successful server response, not the visible price-display time or acceptable sustained performance. Issue [#132](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/132) stays open.
- The update prevents equivalent saved-cart inputs from repeatedly restarting price checks, limits long waits, and provides a safe price-check retry. It does not make cached catalog prices authoritative or authorize Pay without a valid current price.
- Historical original freeze: `1021cd113c783e25030fe9c0bda1be9ddcf5888c`, [PR #130](https://github.com/WB-DevWorld/cetech-pwa-pos/pull/130), deployment `dpl_89TVtntmRzjMi8WgdgvkU35KVFLn`, CI #1466. The owner’s urgent issue #132 instruction superseded that freeze for this correction only. Record results before and after the update separately.
- The earlier generated deployment address rejected the session origin. Use the accepted shared address above; do not substitute generated deployment links.
- The original pre-freeze sweep covered cashier access, catalog, sale/recovery, stored receipts/reprint, return safety, invitations, X report and responsive Management with automated and/or live evidence. Six stale tickets (#103, #113, #116, #118, #126, #128) were closed.
- Remaining evidence: #132 (T23/T30), #114 (T100–T104), #117 (T40/T60/T61), #112 (T92), #87 (T25), #86 (T05), #115 (specialist investigation). #102 remains protected historical work.
- Register availability above is an earlier snapshot. The administrator checks actual allocations and readiness before each tester starts.
- This is a staff-testing build. It is not a production release or proof that the remaining human/device checks passed.
- Session start / first tester: fill in the private working copy.

</details>
