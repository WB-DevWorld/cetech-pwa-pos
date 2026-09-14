# WF-OWN-01: Ownership-preserving workflow correction

Date: 2026-09-13. Scope: explicit senior/user instruction to preserve human task ownership before R5. Actor/editor: WS3 / @wbdevworld; mode: IMPLEMENT governance only. Branch: `fix/ownership-preserving-milestones`. Requested independent reviewer: Ben, subject to actual GitHub request/approval. No product task is reassigned. Domain contracts v1.0.0 unchanged; no migrations, dependencies, workflow/check changes, reference changes or business-system effects.

## Refreshed reality and decision

- Main start: `516d6a49af74cc6677f67bdf843de6e819a05feb`, R3 merged.
- R4/#41: OPEN, observed head `6a87e62034a26e5991af8c06cda92e7b7a72b02b`; author Ben; Emmanuel re-review outstanding. Latest recorded changes-requested review was against `9703b275e16e3f333756e23c5fd1b23b74d5493c`; newer head contains a reported fix, not independent acceptance. Preserve #41 and do not dismiss its reviews.
- Read main and R4 AGENTS/ownership/ledger, ADRs/register, current architecture, long-running/merge/milestone policies, workstream queues/plans, templates/prompts/CI, PR commits/reviews and issues #18/#24. No repeated twenty-pass historical onboarding. Latest explicit user direction refines the already-reconciled source plan/Transfer Kit.
- R4's combined lease lists multiple owners' paths; clarify that import/coordination scope does not grant implementation rights. Author/committer data alone does not establish which human implemented source changes.
- R5 BR-06 is WS2/Emmanuel; CORE-05 is WS3. Existing CORE-05 dependency DAG permits mocked adapter preparation and must not acquire an accidental BR-07 cycle. Execution/import order and activation are separate from that DAG.
- Main's older R3/R4-preparation ledger snapshots are historical where overridden by the current coordination section. This correction does not import R4 implementation/evidence, claim its completion, or begin R5.
- A separate narrow governance PR avoids adding unrelated changes to R4's pending re-review. Record one additional corrective review outside the ten planned delivery closures, as allowed by ADR-012. Do not split or renumber existing milestones.

## Policy implementation

ADR-014 amends only ADR-012 continuation/branch-selection scope. AGENTS, Cursor rules, CONTRIBUTING, ownership, CURRENT-WORK, three workstream TASKS/IMPLEMENTATION-PLAN files, the planner/handoff/reviewer/PR template, merge/milestone standards and six transition prompts reference the same canonical ownership rule. Same human AND workstream plus scope/lease are necessary before implementation. No permission is inferred from a branch prefix, account, mixed path list, unavailability or an agent-created reassignment record.

Provisional handoff fields: owner/actual implementer; source branch/SHA; import SHA; tested combined SHA and classification; receiving owner/acknowledgment; tests/limitations; explicit reassignment authority or NONE. Future milestone branches are neutral batch/rN-*. Review fixes return to the owning human; review coverage is independent by contribution. Existing two-pass final cutoff is unchanged. These are agent/review controls, not a claim that Markdown or CODEOWNERS is a filesystem ACL.

## Manual policy scenario assessment

These are reviewed routing scenarios against the written rules, not executable tests of human behavior or a new authorization engine.

| Scenario | Required disposition checked in policy/templates |
| --- | --- |
| WS3 completes CORE-04; next task FE-03 | Stop FE implementation; publish tested integration SHA; Ben receives task |
| Ben unavailable; CORE-04 dependency already ready | WAITING_FOR_OWNER for FE lane; only explicitly queued independent WS3 work may continue |
| Ben receives tested CORE-04 integration SHA not on main | Can branch/read/test from that exact declared SHA and implement WS1 paths; no per-task main merge |
| WS3 attempts FE-04 fix because it is on the milestone branch | Return finding to Ben; integration role/path union is insufficient |
| WS3 creates a ws1 branch or calls another agent WS1 | Human ownership does not change; explicit senior reassignment still required |
| Senior explicitly reassigns a bounded task | Record old/new human/workstream, scope, authority, reason, expiry and reviewer first; no broader transfer |
| Owner's commit has a semantic conflict during import/freshness | Return to owner; no wholesale ours/theirs or unapproved behavior edit |
| All three contribute to neutral R6 PR | Record cross-review coverage; nobody supplies independent approval of their own contribution |
| New upstream change after freshness Pass 2 | Integration/review input; no third autonomous reconciliation pass |

## Verification

- `python3 scripts/verify_control_plane.py`: PASS; 30-task DAG, references, contracts and links retained.
- `python3 -m unittest discover -s tests/tooling -q`: PASS, 48 tests. No new tests that merely mirror Markdown were introduced.
- `git diff --check`: PASS.
- Diff of apps, wordpress, supabase, scripts, tests, .github/workflows, contracts, reference and package/lockfiles: empty. Product/runtime verification remains the unchanged required GitHub CI on the final candidate; final-head results belong in the PR handoff.

## Start freshness

Successful main fetch observation: `2026-09-13T23:39:16.315295Z`; main/head `516d6a49af74cc6677f67bdf843de6e819a05feb`. Own correction branch is candidate; independent batch baseline NOT_APPLICABLE. The isolated clone was clean before work. At this recorded observation only the newly written, authorized ADR-014 draft was untracked; it was preserved and subsequently committed. No undocumented product work existed. Applicable baseline: ADR-012 active, ADR-013 accepted with R3, v1.0.0, current explicit ADR-014 instruction/lease. R4 is observed review context, not an adopted upstream dependency.

Final two-pass snapshots, final candidate head, CI, review request and merge status will be reported in the PR handoff. An absent result is UNVERIFIED, not PASS. Final hashes are recorded outside their own commits.

## External behavior checked

[Git cherry-pick](https://git-scm.com/docs/git-cherry-pick) applies selected commits and can retain source references with -x; it does not assign human implementation ownership. [GitHub required reviews](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/approving-a-pull-request-with-required-reviews) explains that PR authors cannot approve their own PR and significant new changes can invalidate approvals. Neutral branch ownership, explicit reassignment, contribution review coverage and exact provisional-SHA handoffs are CETECH policy choices. No GitHub administration/protection change is requested by this correction.
