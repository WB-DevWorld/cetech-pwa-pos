# CETECH POS staff documentation

> **Current testing round (9 October 2026) — use this only**  
> POS: https://cetech-pos-staging-q2u9baevb-wbdevworlds-projects.vercel.app  
> BUILD_ID: `a4f3284c35785dbb0efe3843d38084f12911ac15`  
> Checklist: [TESTER-ACCEPTANCE-CHECKLIST-a4f3284.md](../testing/parallel-completion-2026-10-07/TESTER-ACCEPTANCE-CHECKLIST-a4f3284.md)  
> Scope: device / PWA / cache / scanner and existing order **50317** receipt / paper.  
> **Do not** click Pay, create a new sale, charge, refund, or run a stock experiment.  
> Older links below (including `git-integration-9578df` and the management-remediation packet) are **historical** for this round.

**Current testing documents updated:** 9 October 2026 — a4f3284 staging candidate handoff.

**Read and understand the current Test Brief first.**

The management candidate is under qualification. Check the brief for the confirmed live build before testing its new controls.

[Open the formatted testing documents](https://github.com/WB-DevWorld/cetech-pwa-pos/tree/ws3/management-remediation-2026-10-03/docs/staff/testing-2026-10-02#readme) — historical packet; for **this** round use the a4f3284 checklist above instead.

**[Open the POS for this round](https://cetech-pos-staging-q2u9baevb-wbdevworlds-projects.vercel.app)** — BUILD_ID `a4f3284…` (supersedes the older git-integration link for current testing).

These files are the **canonical staff-facing documentation** for CETECH POS.

Use plain English. Teach what the person needs to do, what they should expect to happen, and what they should do next. Do not expose internal engineering language to cashiers.

## Which document should I use?

- [Staff Training & User Guide](STAFF-TRAINING-GUIDE.md) — learn how to use the POS during normal work.
- [Staff Testing & Acceptance Workbook](STAFF-TESTING-ACCEPTANCE-WORKBOOK.md) — choose independent testing modules and record results.
- **[Current Test Brief — issued 2 October 2026](TEST-BRIEF-2026-10-02.md)** — the POS link, designated Admin setup, and rules for the next round.
- [Test Brief — 24 September 2026](TEST-BRIEF-2026-09-24.md) — historical record only; do not reuse its POS link.
- [Documentation Maintenance Policy](DOCUMENTATION-MAINTENANCE.md) — rules for keeping these guides synchronized with the application.

## Important status rule

The POS changes frequently during qualification. A staff test must always record the **exact build/SHA and test URL** in the Test Brief before testing starts.

A green build, a reviewed PR, a staging Preview, and a production release are different things. Do not assume a feature is live merely because it exists in source code.

## Audience

- **Cashier:** daily selling, customers, orders, returns, register, receipts, safe offline behavior.
- **Manager:** operational supervision, shift/cash oversight, approvals, register assignments where authorized.
- **Owner/Admin:** organization control, staff accounts, locations, registers, devices, receipt settings, policies.
- **Support:** diagnostics/audit only where authorized.

Technical details belong in Management/support areas. Cashiers should not need technical identifiers to complete ordinary work.
