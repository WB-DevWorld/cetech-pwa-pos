# CETECH POS — Staff Documentation Maintenance Policy

This policy keeps staff documentation synchronized with the actual POS.

## 1. Canonical documents

The canonical staff-facing documents are:

- `docs/staff/STAFF-TRAINING-GUIDE.md`
- `docs/staff/STAFF-TESTING-ACCEPTANCE-WORKBOOK.md`
- dated Test Briefs under `docs/staff/`

PDF, Google Docs, Word documents, screenshots, handouts, and printed copies are **derived copies**. They do not replace the repository Markdown.

## 2. Same-change rule

When a confirmed application change affects anything a staff member is taught, sees, does, tests, or is warned about, the relevant `docs/staff/*.md` file must be updated **in the same pull request/change set**.

Examples that normally require a documentation update:

- screen/navigation changes;
- button or field wording;
- cashier/manager/admin role changes;
- permissions;
- staff creation/invitation/password behavior;
- selling/cart lifecycle;
- product/barcode behavior;
- customer/wholesale behavior;
- payment methods or payment recovery;
- receipt content/printing/settings;
- Orders;
- Returns/refunds/approvals;
- Attention/recovery;
- register/shift/cash close;
- offline/reconnect behavior;
- local cart/draft behavior;
- Settings/System status;
- Management sections;
- locations/registers/devices;
- operational rules;
- known limitations;
- staff acceptance tests.

## 3. What does not require a staff-doc change

A change can be declared **No staff documentation impact** only when it genuinely does not change staff-visible or staff-testable behavior.

Examples can include:

- internal refactor with identical behavior;
- dependency/security patch with no visible behavior change;
- internal logging;
- test-only changes;
- CI-only changes;
- documentation that is not staff-facing.

The PR reviewer must challenge an incorrect “no impact” declaration.

## 4. PR declaration

Every PR must choose exactly one:

- **Staff documentation updated**
- **No staff documentation impact**

If “updated” is chosen, at least one canonical `docs/staff/*.md` file must change in the PR.

If “no impact” is chosen, the PR description must briefly explain why.

## 5. Staff documentation is part of Definition of Done

A user-facing change is not complete if:

- source code changed;
- tests passed;
- but the affected staff guide/test case still describes the previous behavior.

“Code complete” and “documentation synchronized” are both required.

## 6. Test cases move with behavior

When behavior changes, update both:

1. how staff are taught to use it; and
2. how staff acceptance testing verifies it.

For example:

- if payment recovery wording changes, update the Training Guide and payment test cases;
- if a new Management permission is added, update the role explanation and Management tests;
- if offline capabilities change, update the Offline section and offline acceptance tests.

## 7. Build-specific information

Permanent guides should explain durable behavior.

Build-specific items belong in the Test Brief:

- exact SHA;
- exact Preview URL;
- enabled payment methods;
- test accounts/roles;
- registers/devices;
- known build-specific defects;
- session-specific safety restrictions.

Do not hard-code a temporary Preview URL into the permanent Training Guide.

## 8. Role boundary

Cashier guides use ordinary retail language.

Technical details may be documented for Manager/Admin/Support only when they are genuinely exposed to those roles.

Do not teach cashiers:

- internal API/provider names;
- database IDs;
- raw UUIDs;
- schema versions;
- correlation IDs;
- IndexedDB;
- idempotency;
- internal reconciliation terminology;

unless a specific support procedure requires it, and then keep it in a clearly separated support/management section.

## 9. Review rule

For changes affecting staff documentation, reviewers should verify:

- the guide matches the UI wording;
- steps exist in the actual build;
- role restrictions are correct;
- safety warnings are correct;
- tests in the workbook still verify the intended behavior;
- no unaccepted future feature is presented as live.

## 10. Before a staff test

The coordinator must:

1. freeze/select the exact test build;
2. fill the dated Test Brief;
3. verify guide steps against that exact build;
4. mark known limitations;
5. provide approved test accounts/registers/devices;
6. provide permitted payment/return test boundaries;
7. stop the session if the test build changes unexpectedly.

This policy is enforced by repository PR/CI rules in addition to human review.
