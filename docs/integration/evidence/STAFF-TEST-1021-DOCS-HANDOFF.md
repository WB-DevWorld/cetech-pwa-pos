# STAFF-TEST-1021 — Documentation handoff

Date: 2026-10-02. Workstream: WS3. Human/editor: `@wbdevworld` under the current owner instruction. Scope: documentation for the next staff-testing round, using understandable English.

## Result

- New [dated Test Brief](../../staff/TEST-BRIEF-2026-10-02.md) pins application `1021cd113c783e25030fe9c0bda1be9ddcf5888c` and its exact READY Preview.
- [Workbook](../../staff/STAFF-TESTING-ACCEPTANCE-WORKBOOK.md) has 16 independently selectable modules, their prerequisites, role boundaries, evidence fields and local ordering requirements.
- All 61 original T-numbered tests and their detailed instructions/expectations are retained. New checks are T05 (controlled infrastructure/sign-in failure), T25 (stale catalog refresh), and T92 (shared-browser recovery ownership), bringing the total to 64.
- T131/T132/T136 gain setup steps. The prior T63 label is corrected: Owner/Admin may change receipt settings; Manager checks the permitted read-only view.
- Designated Admin provisions the team and primarily tests Management. Cashiers keep cashier-only access and separate registers. Admin may sell with a separate operational assignment. Live allocations remain for the administrator to complete.
- [Training Guide](../../staff/STAFF-TRAINING-GUIDE.md) records the durable Admin/operational-role distinction and one-open-or-closing-shift-per-register rule.
- [Documentation Home](../../staff/README.md) points to the new brief and labels the September 24 brief historical. The old brief is byte-for-byte unchanged.
- Markdown hard breaks between result fields use backslashes rather than trailing spaces so whitespace checks remain clean. The final field in each paragraph has no backslash. Original test content is preserved semantically.

## PR #131 review formatting fix — 2026-10-02

Owner instruction: fix the review finding. WS3 editor: `@wbdevworld`; existing STAFF-TEST-1021 documentation scope. Starting PR head: `e5b2ed4b3674edd6bb3d5789cd06cf269de5caa2`. The fix is published on the same documentation contributor branch and PR.

- Removed the paragraph-final backslash from 65 `Other notes` fields (the example and 64 test result blocks). Line breaks between fields remain intact; all other workbook text is unchanged.
- GFM rendering with the installed `marked` parser: PASS — 65 `Other notes` fields and zero visible trailing backslashes.
- Reran `python3 scripts/verify_control_plane.py`: PASS (exit 0); `python3 -m unittest discover -s tests/tooling -p test_staff_docs_impact.py`: PASS (3 tests, exit 0); task-scoped preservation/link check: PASS (exit 0); `git diff --check`: PASS (exit 0).
- Allowed changes: workbook and this handoff. Contracts, ADRs and migrations: none. The exact frozen application link, 61 original tests, 3 added tests, 16 modules and historical September brief are preserved.

| Follow-up observation | UTC | main | Declared integration upstream |
| --- | --- | --- | --- |
| Start | 2026-10-02T11:55:24.867Z | `c49045dd02c46574af5d341cc65c177116fa7306` | `1021cd113c783e25030fe9c0bda1be9ddcf5888c` |
| Pass 1 | 2026-10-02T11:56:22.129Z | `c49045dd02c46574af5d341cc65c177116fa7306` | `1021cd113c783e25030fe9c0bda1be9ddcf5888c` |
| Pass 2 / cutoff | 2026-10-02T11:56:35.172Z | `c49045dd02c46574af5d341cc65c177116fa7306` | `1021cd113c783e25030fe9c0bda1be9ddcf5888c` |

Both upstream observations succeeded and were unchanged: FRESH_2. No reconciliation was needed. The final published fix SHA and its CI result are supplied externally; independent human review remains required before integration.

## Provenance and application boundary

Source: `integration/r9-staff-remediation-final` / PR #130, application SHA `1021cd113c783e25030fe9c0bda1be9ddcf5888c`. Documentation contributor branch: `ws3/staff-testing-1021cd-2026-10-02`.

Implementation checkpoint: `b3b9197d57825f737cdf645eea1929edb8e5c1db`. The final documentation SHA is the commit containing this handoff and is supplied externally, not self-referenced here.

Live read: CI #1466 / run `36994717064` is SUCCESS on the application SHA. Vercel deployment `dpl_89TVtntmRzjMi8WgdgvkU35KVFLn` is READY, Preview target, with metadata identifying that SHA and URL `https://cetech-pos-staging-qn5v3m37s-wbdevworlds-projects.vercel.app`.

No application, contract, ADR, migration, package, dependency, CI, account, role, register, device, shift, order, payment, return, stock or production mutation is included. Frozen application runtime stays at its exact URL. No electronic payment, protected #102 reconciliation, PR130/main merge, production promotion or VitePOS cutover is authorized by this change.

## Validation

- `python3 scripts/verify_control_plane.py`: PASS — 3 workstream packages, 30 scoped tasks/DAG, 28 immutable reference files, 82 schemas, 68 fixtures, OpenAPI references, generated types, local file links and secret tripwires.
- `python3 -m unittest discover -s tests/tooling -p test_staff_docs_impact.py`: 3 tests, PASS.
- Task-scoped preservation/link check: PASS — 61 original IDs and per-test details retained, 64 unique IDs total, one explicit T63 permission-label correction, 16 modules, new test step/expectation/result blocks, local links and heading anchors, exact application/link binding, historical brief byte identity, valid staff-doc declaration.
- `git diff --check`: PASS after Markdown hard-break normalization.
- No application, live checkout, database, financial, installed-PWA or hardware test was performed in this documentation-only task. Prior application CI is not new staff/device acceptance.

## Bounded freshness

| Observation | UTC | main | Declared integration upstream |
| --- | --- | --- | --- |
| Start | 2026-10-02T11:11:56.982Z | `c49045dd02c46574af5d341cc65c177116fa7306` | `1021cd113c783e25030fe9c0bda1be9ddcf5888c` |
| Pass 1 | 2026-10-02T11:23:17.664571Z | `c49045dd02c46574af5d341cc65c177116fa7306` | `1021cd113c783e25030fe9c0bda1be9ddcf5888c` |
| Pass 2 / cutoff | 2026-10-02T11:23:56.906946Z | `c49045dd02c46574af5d341cc65c177116fa7306` | `1021cd113c783e25030fe9c0bda1be9ddcf5888c` |

Public Git read/clone and fresh local fetches succeeded. Both final upstream comparisons have no changed paths. Freshness status: FRESH_2. No third autonomous freshness pass was performed. Later arrivals belong to integration/review.

## Delivery and review

Local documentation preparation and validation: COMPLETE. Public publication: AUTHORIZED by the owner's explicit reply on 2026-10-02 at 11:32:37Z to publish the completed files to the public GitHub repository and open a documentation review PR. The earlier push was rejected by automatic approval review for missing explicit public-upload permission and potential sensitive-data disclosure; no alternate publication route was attempted. The owner's subsequent authorization resolves that publication gate.

Different competent human exact-head review remains required before integration by repository policy. No reviewer request or person-directed message is included. Publication is through the contributor branch and a draft PR; no protected branch merge is included. Record the actual published SHA, PR and CI status in the external handoff.

Publish the prepared documentation branch and open a documentation-only draft PR against `integration/r9-staff-remediation-final`. Use the draft description below. Preserve the frozen application link, require the documentation CI/review, and do not merge the runtime candidate as part of this task. The follow-up publication does not restart or extend the completed two-pass freshness cutoff above.

## Prepared draft PR description

### Problem and resulting behavior

The next staff round needs a brief for the frozen application and a workbook that staff can start independently. This change pins the exact testing URL, assigns team setup to one designated Admin, and reorganizes the existing workbook into 16 selectable modules while retaining every existing test ID/detail. Separate registers provide separate shifts; cashier-only access remains part of testing.

### Ownership and scope

STAFF-TEST-1021, WS3 / senior `@wbdevworld`, documentation only. Baseline application: `1021cd113c783e25030fe9c0bda1be9ddcf5888c`. No cross-workstream implementation or reassignment. Only staff docs, CURRENT-WORK and this handoff change. Architecture/contract guardian: PASS; contracts, ADRs, migrations, dependencies and runtime effects: NONE.

### Evidence and limitations

Foundation check, staff-doc impact tests, original-test preservation, heading/file links, historical brief byte identity and whitespace checks pass. FRESH_2 cutoff is above. No new device/hardware/business acceptance is claimed. Exact-head independent human review and documentation PR CI remain pending. Staff still use the frozen application's existing exact URL.

### Staff documentation impact

- [x] Staff documentation updated
- [ ] No staff documentation impact

Affected: `docs/staff/README.md`, `docs/staff/TEST-BRIEF-2026-10-02.md`, `docs/staff/STAFF-TESTING-ACCEPTANCE-WORKBOOK.md`, `docs/staff/STAFF-TRAINING-GUIDE.md`.
