# Handoff — Print/PWA/Recovery continuation (2026-10-09)

```text
Kind: BATCH_COMPLETION / continuation after CETECH-POS-Cursor-Completion-Continuation.md
Workstream: WS3 @wbdevworld · bridge review WS2 @Emmanuel-coder-prog
Branch: ws3/combined-candidate-2026-10-08 · PR #144
Selected base: 7d5778fe904792360947d88122050e529587aa51
Product commit: 542d3ef2f862394a762de43eacf00c724b17aaec (parent 7d5778f)
Evidence tips: 67b008c… → 67f89b1… → 40436ac… → 7f64eec6ebaa2df667605c40fbc6ac5d88a407bb (re-verify HEAD at read)
Contracts/migrations/ADRs: none
Staff-documentation impact: NONE
Production: NOT READY · no alias move · A+D consumed · RD-01 not re-applied
```

## What is usable now

- Orders historical Reprint **source fix** is on #144: history receipt/print ports without inventing checkout/shift.
- f0 Preview still proves receipt display, draft/offline/reconnect harness behavior, and open-shift browser print dialog.
- Exact SHA Preview decision is written and ready for independent review + authorized dispatch.
- Backup rollback tarball identity re-verified; FPM reports idle under signed-off read (not cutover proof).
- B/C commercial sheet is concrete and waiting for a **new** senior GO (and C stock=1 fixture).

## What still blocks production

No-scope Reprint not runtime-qualified on a corrected Preview; no installed cashier PWA; no physical scanner/printer proof; no full Woo+POS restore set/disposable restore; native FPM cutover identity UNVERIFIED; B/C not executed; #115/#132 open; speculative profiling parked.

## Matrix

| Check | Result | Evidence |
| --- | --- | --- |
| Recover full SHAs / parents / publish to #144 | **PASSED** | GitHub resolves `542d3ef…`, `67b008c…`, `67f89b1…` |
| Scoped diff vs IMPACT allowlist | **PASSED** | product files + tests + docs/testing + CURRENT-WORK |
| Vitest connected reprint/print/checkout/workspaces | **PASSED** | 32 then 7 after neg-control expand |
| PWA lifecycle harness | **PASSED** (TEST-ONLY) | 22/22 `pwa-lifecycle` + `service-worker-lifecycle` |
| tsc / focused eslint | **PASSED** | exit 0 |
| Exact SHA Preview deploy | **NOT RUN** | PREVIEW-DECISION-HISTORY-REPRINT.md — needs review+auth |
| No-scope Reprint on corrected Preview | **NOT RUN** | blocked on Preview decision |
| f0 open-shift Reprint dialog | **PASSED** (prior) | LANE2-PWA-DEVICE-01 |
| Installed standalone PWA | **NOT RUN** | dedicated cashier device required |
| Physical scanner/printer | **NOT RUN** | hardware unavailable |
| Backup inventory (bridge tarballs) | **PASSED** | LANE3-RECOVERY-CONTINUATION-01 · sha c20239f1… |
| Full WP/Woo+POS dump set | **NOT RUN** / missing | databases dir empty |
| Disposable restore | **NOT RUN** | no named local target |
| FPM signed-off idle | **PASSED** (limited) | `{"accepted":true,"reason":"idle"}` |
| FPM historical cutover opcode | **UNVERIFIED** | cannot manufacture |
| B electronic TEST | **NOT RUN** | prep ready — needs GO + 49111 revalidate |
| C last-unit | **NOT RUN** | candidate Woo **49663** @ stock=1 (POS-map UNVERIFIED; GHS 12500 caution) + GO |
| #115 / #132 | OPEN | unchanged |

## Corrected Preview decision (summary)

```text
gh workflow run "Exact SHA Preview" --ref main \
  -f candidate_sha=<40-char-current-pr-head> \
  -f pr_number=144
```

BUILD_ID = Git source SHA. Do not label as f0. Do not move shared tester. Product composition matches `542d3ef` if head only adds docs/tests.

## Rollback

- Source: revert/leave PR commits; f0 Preview retained.
- No alias or production change performed.

## Next exact actions

1. Independent exact-head review of #144 tip; wait CI green on tip.
2. Owner-authorized Exact SHA Preview dispatch; then no-scope Reprint qualification on 50317.
3. Cashier-device installed PWA + hardware when available.
4. Capture complete Woo+POS dumps into named disposable restore target.
5. New senior GO for B and/or C after fixtures filled.
