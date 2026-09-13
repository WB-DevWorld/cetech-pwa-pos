# Long-running assignments and bounded freshness

Authority: [ADR-012](../decisions/ADR/012.md), amended by [ADR-014](../decisions/ADR/014.md) for human-owner handoffs and R5+ branch selection. This is the canonical operational policy adapted from CETECH-Long-Running-Work-and-Review-Plan.md, not a second Transfer Kit. Execution activation: reviewed R1/#40 merge to main. [CURRENT-WORK](../../CURRENT-WORK.md) is the only cross-workstream scheduler. The [milestone plan](MILESTONE-REVIEWS.md) defines review boundaries; workstream TASKS define detailed acceptance.

## Task, checkpoint, assignment and review

- A task is one bounded implementation unit with an owner, allowed/forbidden paths, inputs and acceptance tests.
- A commit/checkpoint preserves scoped progress and evidence. Push authorized progress approximately every 30–60 minutes or coherent completed subtask, whichever is first. Timing is an operating target, not proof of correctness.
- A batch/assignment is the explicitly approved ordered queue in CURRENT-WORK and the linked workstream TASKS. Before each implementation task verify the acting human/workstream matches its declared owner and that its paths/leases and dependencies are authorized. Implement, test, inspect, commit/checkpoint, then automatically select another ready task only for that same human/workstream. At a cross-owner transition stop implementation and publish the dependency handoff below; the milestone assembly queue is not one agent's implementation queue. No new prompt, PR or approval for an ordinary subtask.
- A milestone PR collects related contributions and integrated acceptance evidence for independent human review. Ten planned remaining closures are a budget; review revisions and necessary additional fixes are allowed. Narrow or split a batch that cannot be understood and challenged in a focused review; record the budget adjustment.

Do not create a feature from a task title alone: consume its full existing task contract and current APIs. No agent may expand its queue, file lease, acceptance waiver or architecture through its own plan. Source-of-truth precedence and all existing security/data/PWA restrictions remain in force.

## Dependencies and uninterrupted useful work

Classify each action as ACCEPTED dependency, PROVISIONAL_TEST at a declared SHA, PREP_ONLY against approved mocks, or BLOCKED. A predecessor implemented and tested in the same batch may be consumed provisionally if its unchanged contract and exact integration SHA are declared. Its task is not marked merged or live accepted. Breaking/new contracts still follow the contract-change process before dependent implementation.

Unavailable dependencies block only their dependent actions. Select another explicitly authorized independent task or preparation item in the queue; do not invent filler work. Pricing parity blocks authoritative checkout acceptance, not independent catalog preparation. Payment credentials block real provider tests, not UI states. Fiscal facts block applicable production behavior. Unsafe training mail/order/stock boundaries block affected remote writes, not synthetic local tests. [ADR-011](../decisions/ADR/011.md) and [CP-04 checklist](../runbooks/CP-04-REMAINING-WORK.md) apply.

Stop affected work for a new business/architecture decision, unauthorized contract change, ownership conflict, missing necessary permission, unsafe/destructive action, ambiguous external transaction outcome or human release decision. Stop the assignment at batch completion, exhaustion of ready authorized work, or a session/context limit. A new milestone may be prepared only as already authorized in the ledger; do not silently widen the current assignment.

## Branches, integration and review

Use separate short-lived ws1/**, ws2/**, ws3/** or fix/** branches/worktrees. From R5 onward, every milestone uses a neutral WS3-owned temporary batch/rN-<scope> integration branch/PR, with separate contributor branches. R1/#40 and R4/#41 are historical/explicit exceptions; preserve #41 through its current review, but never repurpose another contributor PR for a future milestone. At most one milestone is being assembled for final review at a time; independent preparation lanes remain available.

Contributors publish tested commit SHAs and evidence. The editor imports only declared commits (for example individually inspected cherry-picks preserving source SHA provenance), never blindly an entire contributor branch. Semantic conflicts go to the responsible owner. Do not choose ours/theirs wholesale, force-push peers, rewrite published history for cosmetic freshness, or compete on central files. No new permanent branch hierarchy.

Keep one draft PR targeting main per milestone; update it as contributions arrive and run combined checks frequently, normally at coherent checkpoints within a few hours. Review is requested when the milestone gate passes. Work on separate branches does not justify days without integration. A green component test is not evidence of a combined cash sale.

After squash merge, start the next work from updated main. Preserve unpublished work and transfer only not-yet-imported commits to a fresh branch, with source mapping. Do not reset another checkout. Runtime databases, ports, browser origins/IndexedDB and remote fixtures need isolation beyond Git worktrees.

Senior-authored changes require a different competent human. Name reviewers in the ledger; an AI review does not supply that approval. Review the final tested head; later modifications may invalidate approval. Keep GitHub main protections and required checks. The integration editor re-evaluates changes arriving after the contributor's cutoff before merging; a freshness report is not permission to bypass GitHub.

## Ownership-preserving milestone execution

ADR-014 makes these requirements explicit. One milestone PR is a combined review surface. Task ownership survives milestone batching; a combined allowed-path list describes contributions, not permission for every editor to implement them.

### Before each task or review fix

Record acting human, workstream, mode (IMPLEMENT or INTEGRATE), task ID, declared human/workstream owner, allowed/forbidden paths and lease. A ready task may be implemented only when both human and workstream match, or a prior explicit senior reassignment record applies. Path access alone, a `ws1/` branch name, the integration Git account, a spawned agent, or moving code into another directory cannot establish or change human ownership. Do not rename tasks or split sessions to evade this check.

Automatic continuation stays inside the acting owner's authorized queue. At the first cross-owner dependency: **STOP IMPLEMENTATION → publish exact tested dependency SHA → hand off to the named owner.** This stops the dependent implementation lane, not all coordination. WS3 can review, monitor CI, import declared commits, test the combined tree, or perform another explicitly authorized independent WS3 task. It cannot implement WS1/WS2 feature behavior under the label 'integration glue'. App Router/BFF/shared glue still needs its own bounded WS3 scope.

Owner unavailable means WAITING_FOR_OWNER for that dependency lane. It is never permission to take the task. Choose an already authorized independent task owned by the same human/workstream, or pause with the next action. Never manufacture filler work.

### Cross-owner dependency handoff

1. Owner A implements/tests their task on their isolated contributor branch and publishes its declared commit(s), paths, contracts, limitations and final two-pass evidence when delivering the task.
2. The WS3 editor imports only those declared commits into the milestone branch (inspect each; `git cherry-pick -x SOURCE_SHA` where applicable). Record source-to-import mapping; retain real author/committer provenance. A semantic conflict or required change to contributor behavior returns to its owner. Never silently resolve it by taking whole sides or editing that behavior yourself.
3. Run applicable combined checks on the imported tree. Publish the exact integration SHA, tested result and dependency classification **PROVISIONAL_TEST / INTEGRATED_AND_TESTED**. CI-passing mocks remain mocks; missing acceptance stays blocked. Earlier accepted contracts and safety restrictions remain controlling.
4. Owner B receives that exact integration SHA and creates an isolated branch/worktree from it. No intermediate merge to main is needed. Preserve existing work; transfer only declared not-yet-imported commits. Branching from a combined tree grants read/test access to dependencies, not implementation rights to them.
5. Owner B changes only their scoped implementation and returns tested source SHAs. The editor imports and re-tests; hand the next declared combined SHA to the next owner. Test at each integration checkpoint and again at milestone readiness.

Use the [handoff template](../ai/HANDOFF-TEMPLATE.md). Record task ID, declared owner, actual implementing human/workstream, source branch and source SHA(s), imported SHA(s), tested combined SHA, integration branch, next task/owner, exact tests and results, contract version, freshness cutoff, limitations and reassignment authority (or NONE). The receiver acknowledges the pinned baseline in their first checkpoint. Missing provenance is UNVERIFIED and blocks acceptance of that contribution; commit author names alone are not sufficient evidence. A progress-only preview does not masquerade as final task delivery or force the two-pass protocol after every tiny commit.

Clean-worktree example (the editor supplies a real full SHA; this is not a literal runnable ref):

```text
git fetch origin --prune
git worktree add ../pos-ws1-runtime -b ws1/fe-03-runtime INTEGRATION_SHA_1
```

Declare this milestone ref/SHA in the starting snapshot. Observe main plus that declared baseline during final freshness; never automatically consume arbitrary peer branches. Exactly two final passes still apply. A cross-owner conflict discovered during freshness produces a handoff, not permission to repair the other owner's code or run a third pass.

### Explicit reassignment and review return

Only an explicit senior human instruction can reassign implementation. CURRENT-WORK must record: task ID; original and new human/workstream; exact scope/paths; authority reference and date; reason; start/end or milestone expiry; dependencies/leases; handoff/notification status; and independent reviewer. A ledger edited by an agent without that instruction does not grant authority. Default is **NONE**. Shared-path delegation is scoped and does not transfer an entire task.

Review findings name the owning task/human. FE-04 findings return to Ben; bridge findings to Emmanuel; core/server/local findings to WS3. Cross-domain findings become separate owned fixes at the shared boundary. The original owner fixes/tests/checkpoints; WS3 imports and reruns affected combined checks. If the owner is unavailable, wait or obtain and record explicit reassignment; no automatic integrator takeover. Keep review-size and human-decision escalation rules.

Neutral PR authorship does not replace independence: a person cannot independently approve their own contribution. Record final-head review coverage by task/implementer/reviewer; a mixed milestone can use Ben and Emmanuel to cross-review each other's contributions and WS3 work. GitHub PR authors cannot approve their own PR. Keep current protections and mandatory independent approval; this does not require a fourth developer or an extra PR for every fix.

### R4 transition and R5/R6 boundaries

Preserve #41 and existing source/import history. This correction neither accepts its current head nor dismisses reviews. Future FE findings go to WS1; this governance task does not authorize new R4 code fixes. Historical milestone leases listing multiple owners' paths are import/coordination scope, never an implicit reassignment.

R5 target branch: `batch/r5-idempotent-prepare-cash`. Once R4, policy adoption, pre-R5 gates and the R5 lease are accepted, Emmanuel implements BR-06; WS3 imports/tests and publishes BR06_INTEGRATION_SHA; WS3 implements CORE-05 against that pinned boundary on a separate ws3/** contributor branch; the editor imports/tests the result. CORE-05's existing mock preparation permission is preserved only where explicitly queued; it is not live acceptance and does not add a BR-07 dependency. Do not silently alter the task registry's dependency DAG.

R6 has three contributors: BR-07 Emmanuel/WS2, FE-05 Ben/WS1, CORE-06 senior/WS3. Owners may work in parallel where declared dependencies permit, exchanging exact provisional SHAs rather than waiting for each task to merge into main. Only CURRENT-WORK activates the queues; a roadmap row does not.

## Start freshness snapshot

1. Check branch, working-tree/index status and the latest handoff; preserve unrelated work. Establish the task queue, owner/lease, contract version and relevant ADRs.
2. Fetch origin (for example `git fetch origin --prune`). A failed fetch means freshness UNVERIFIED; a cached ref is not a fresh observation.
3. Record START_FRESHNESS_SNAPSHOT: UTC, origin/main SHA, and the exact named integration baseline ref/SHA only if declared. Record head SHA, contract version, ADRs, ownership/task/batch revisions and queue authorizer. If no baseline is declared use NOT_APPLICABLE.
4. Main is always observed. A declared batch/rN-* or explicitly registered existing milestone PR branch is provisional test input. Never automatically consume arbitrary peer/experiment branches. The editor's own candidate branch is recorded as its head, not circular independent upstream evidence.

## Final freshness Pass 1

This is mandatory for final task/batch delivery, not every small commit or routine progress checkpoint. Save and push safe scoped progress first; document any unavoidable uncommitted state. Then fetch remote refs and record FRESHNESS_PASS_1_MAIN_SHA and FRESHNESS_PASS_1_BATCH_SHA plus UTC.

Compare each upstream from its start snapshot to its newly pinned SHA. Inspect changed paths and relevant diffs, including imports, dependency graph/lockfile, schemas/APIs, migrations, environment, state machine, authorization, tests and assumptions. Always inspect changed AGENTS, SOURCE-OF-TRUTH, Decision Register/relevant ADRs, contracts, OWNERSHIP, CURRENT-WORK, relevant TASKS/STATUS/HANDOFF and CI/testing rules. No direct-file intersection does not prove irrelevance.

| Classification | Required action |
| --- | --- |
| IRRELEVANT | Record path/reason. No unnecessary implementation edit. |
| COMPATIBLE | Record why the existing implementation remains valid; verify the relevant combination. |
| STALE_REQUIRES_FIX | Fix once within existing authorization, update tests/evidence, commit and rerun affected checks. |
| CONFLICT_REQUIRES_OWNER | Do not edit another owner's implementation; report exact conflict and required owner. |
| DECISION_REQUIRED | Stop the affected decision and report the contract/business/architecture question. |
| UNSAFE_TO_AUTO_RECONCILE | Preserve work and report the unsafe operation, missing history, non-forward upstream or environmental constraint. |

Fetch/inspect/reconcile deliberately; never blindly pull/rebase. For published branches, validate a combined tree in a temporary worktree or the designated integration branch when appropriate. Record both the task head and tested combination SHA. Do not call an unchanged stale branch tested against new main without actually constructing/testing the needed combination. If refs diverged/rewound or history is missing, resolve with the editor; do not hide it using merge-base-only comparison.

After changes run task-specific tests, relevant contract/integration checks, lint/typecheck as applicable, `git diff --check`, and the foundation verifier for governance/contracts. Only rerun unrelated expensive suites if the milestone gate requires them. Missing runtime evidence is BLOCKED/UNVERIFIED, never PASS.

## Final freshness Pass 2 and termination

After Pass 1 reconciliation/testing is complete, independently fetch again. Record FRESHNESS_PASS_2_MAIN_SHA, FRESHNESS_PASS_2_BATCH_SHA and UTC. Compare only upstream arrivals since Pass 1, plus re-evaluate changed authority/contract files. Use the same classifications. An in-scope stale change gets one bounded fix with affected tests and a commit; a conflict/decision blocks the affected work.

After that work, STOP. There is no autonomous Pass 3, including when a later push is visible. Do not reset the start snapshot or rename the same assignment to evade the limit. Post-cutoff changes become integration-editor, PR-review or explicitly next-session input. The cutoff is the second fetched upstream SHA tuple; the final task head may be later because of the recorded second-pass fix/evidence commit. Store final head in an external PR handoff or subsequent checkpoint rather than attempting a self-referential commit hash.

The two observations are independent fetches, not a requirement to use another model. If time/network/session limits prevent completion, publish an interrupted handoff with missing fields UNVERIFIED and delivery BLOCKED; do not pretend two passes ran. Resuming that assignment preserves already completed pass numbers. If Pass 1 has a blocking conflict, Pass 2 can document further drift but cannot grant scope or clear the existing blocker.

Final freshness status is FRESH_2 (neither pass required a fix), RECONCILED_2 (authorized fixes completed), or BLOCKED_BY_DRIFT (unresolved relevant drift). Report delivery status separately: READY_FOR_INTEGRATION only if implementation, tests and both passes are complete; otherwise BLOCKED/INTERRUPTED. This keeps the requested readiness label from concealing whether reconciliation happened. No status means globally or indefinitely up to date.

## Helper and evidence

`scripts/check_upstream_drift.py` is a dependency-free, cross-platform read-only diff reporter. It resolves supplied refs to SHAs, reports forward/non-forward history, changed paths and critical paths as JSON or Markdown. It does not fetch, merge, rebase, edit, determine semantic relevance or grant authority. Run fetch separately and save output in task evidence. `--pass-number` accepts only 1 or 2; this input guard supports the protocol but cannot enforce agent behavior outside the tool.

Example after the relevant fetch (substitute recorded SHAs; use the same command separately for a declared batch baseline):

```text
python scripts/check_upstream_drift.py --base START_MAIN_SHA --upstream origin/main --pass-number 1 --format json
python scripts/check_upstream_drift.py --base PASS_1_MAIN_SHA --upstream origin/main --pass-number 2 --format markdown
```

Use [HANDOFF-TEMPLATE](../ai/HANDOFF-TEMPLATE.md). Record task/batch/workstream, branch/base/head, changed paths/contracts, exact tests/results, remaining work, dependencies, blockers and next exact action. Before quota exhaustion, shutdown or transfer, preserve failed checks and unresolved risks as well as completed work. Record external operation/correlation IDs needed for recovery, without secrets or unnecessary customer data.

Git rollback does not undo Woo orders, payments, refunds, stock, mail, migrations or webhooks. Resolve/reconcile actual external state before retries. No unrestricted production credentials. Code implemented ≠ CI green ≠ PR approved ≠ staging accepted ≠ production approved. Merged capabilities can remain disabled; server authorization enforces restrictions.

## Metrics and review circuit breaker

R1/R2 metrics live in CURRENT-WORK: human interruptions, prompts per accepted task, review waiting time, branch age, time since last combined integration, Pass-1/Pass-2 stale findings, drift rework, conflicts, review defects, review duration and reviewer comprehension. Record UNVERIFIED before observation; do not manufacture zeroes. Use timestamps and counts, not another management system. Improve scope/queues if feedback worsens; never judge success only by PR count.

Twenty-pass historical recovery occurs at onboarding/architecture adoption. Routine sessions refresh the repository, relevant changed sources and handoff. Colleagues receive the supplied plan and Immediate PWA POS 6 in ChatGPT Projects for context; Cursor reads these repository-local policies and the [transition prompts](../ai/transition/README.md).
