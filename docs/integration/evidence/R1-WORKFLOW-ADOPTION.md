# R1 workflow adoption evidence

Scope: senior-authorized governance/tooling addition to existing PR #40. Starting main `cd4477f185c159e18ed939a20145865d665099b4`; starting R1 implementation `860bef52efb53773788f6e06fc1753d8d51670a9`. Starting R4/#41 `ede771bdbe5f05c8b517ce5168c9d8515a354e28`, still preparation with CORE-04 runtime gate. User authorization explicitly expands R1 scope; [scope notice](https://github.com/WB-DevWorld/cetech-pwa-pos/pull/40#issuecomment-5648240556) recorded before edits.

Main protections: branch summary protected=true, required control-plane/control-plane-windows; rulesets list empty. Full classic protection GET denied 403, therefore full settings UNVERIFIED. No protections changed. Ben remains the requested different human reviewer; no self-approval or merge.

Design: ADR-012, canonical LONG-RUNNING-WORK policy, ten milestone mapping, current queues, six role prompts, contributor push CI, read-only drift helper. Existing CORE-01 SQL/schema/RLS, domain contracts, application, bridge, immutable prototype, package/lockfiles are outside this adoption edit.

Validation and final freshness are recorded below as execution completes. Any unrecorded check is UNVERIFIED, not PASS. The final commit SHA is supplied in the PR handoff to avoid self-reference.

## Controlled freshness scenarios

The tooling tests create temporary real Git repositories. A: unrelated documentation delta is reported without checkout/code edits. B: additive contract fixture is surfaced; an authorized consumer fixture adopts the optional field, verifies both old/new payloads, and leaves the upstream contract unchanged. C: a contract-owner change is surfaced without editing it. D: a new authority change between snapshots appears only in Pass 2. E: a post-cutoff commit leaves the recorded cutoff unchanged and a third-pass helper invocation is rejected.

These tests demonstrate mechanical observations/non-mutation and the bounded interface. Semantic classifications and the agent's obligation to stop are policy/review responsibilities; the helper does not autonomously decide compatibility. Additional cases cover rename/delete paths, non-forward history, missing/option-like refs, exact evidence SHAs and preservation of untracked work.

## Local tooling verification

- `python3 scripts/verify_control_plane.py`: PASS (30 task DAG, reference integrity, schema/fixtures, links and secret tripwires).
- `python3 -m unittest discover -s tests/tooling -v`: PASS, 48 tests including 11 read-only drift cases and 2 milestone/CI policy checks.
- YAML parsed with PyYAML BaseLoader; compared all job/step objects to starting #40 head: identical. Only push branch filter expanded. Permissions remain contents: read; PR/manual triggers preserved.
- `git diff --check`: PASS.
- `git diff 860bef5 -- supabase tests/integration/rls apps wordpress docs/contracts reference package.json pnpm-lock.yaml`: empty. Existing implementation bytes preserved.
- Initial local frozen install: BLOCKED by host Node 24.19.0/pnpm 11.19.0 versus required 24.21.0/12.4.1; no pins or checks weakened. Pinned scratch toolchain installation attempted separately; final results follow.
- Docker unavailable locally; database reset/66-case pgTAP must be verified by the existing Linux CI job on the final head. No remote Supabase is substituted.

PR #40 converted to draft while the expanded R1 scope is being verified. No approval or merge recorded.

## Application verification and published checkpoint

- Installed isolated Node 24.21.0 and pnpm 12.4.1; `pnpm install --frozen-lockfile`: PASS with unchanged project pins/lockfile. Registry retries recovered.
- `pnpm --filter pos-web lint`: PASS.
- `pnpm --filter pos-web typecheck`: PASS (Next type generation + TypeScript).
- `pnpm --filter pos-web test`: PASS, 8 files / 20 tests.
- `pnpm --filter pos-web build`: PASS, production static routes generated.
- `pnpm --dir apps/pos-web exec playwright install chromium`: download 502/timeouts in this local environment; local browser smoke not claimed. Final GitHub Linux smoke evidence is recorded in the PR handoff. Docker is unavailable locally; no local database test claim.
- Governance checkpoint published through connected GitHub Git Data API at `5015e0a3647f6693b7de3b2574d00b4a1c766353`. Its tree exactly matches local validation commit `364699b71298e5645c43f3b290d2c038d9176da3`. Native Git push had no credential; API ref update was non-forced.
- Both push run 34715828894 and draft-PR run 34715831158 started for that checkpoint. This verifies trigger execution, not final-head success. Final runs/head/results are linked in the external #40 handoff.
- Updated existing issues #20/#8/#13 and draft #41 descriptions with R1/R4/R2 mapping and existing dependency gates. No new PR, issue closure, protection change, merge, deployment or business-system write.

## Final bounded freshness and handoff

Kind: BATCH_COMPLETION (workflow-adoption contribution to R1; combined R1 review still pending). Owner/integration editor: WS3 / @wbdevworld. Requested different human reviewer: @Ben-001-sys. Published branch: `ws3/core-01-create-pos-operational-schema-and-rls`. Pre-handoff checkpoint: `879e0f9bcf700f2b7a7d145d56938ef8e4bf2ccb`. Final task head is supplied in the external #40 handoff; this final evidence commit follows the cutoff without another refresh.

START_FRESHNESS_SNAPSHOT: main `cd4477f185c159e18ed939a20145865d665099b4`; R1 candidate `860bef52efb53773788f6e06fc1753d8d51670a9`. Start date 2026-09-12; precise start fetch UTC was not retained (UNVERIFIED). Start working tree was clean in an isolated clone/branch. Batch upstream NOT_APPLICABLE: the R1 editor's own branch is its candidate, not an independent authoritative upstream. Contracts v1.0.0 unchanged; ADRs 003/004/005/007/008/009/011 reviewed; ADR-012 and the senior's explicit queue/lease authorize this adoption. Original queue/ownership revision is pinned by the starting R1 SHA; revised queue is pinned by the published checkpoint above.

| Field | Pass 1 | Pass 2 |
| --- | --- | --- |
| Successful independent `git fetch origin --prune` UTC | 2026-09-12T20:04:23.655327+00:00 | 2026-09-12T20:05:03.125645+00:00 |
| Main SHA | `cd4477f185c159e18ed939a20145865d665099b4` | `cd4477f185c159e18ed939a20145865d665099b4` |
| Batch SHA | NOT_APPLICABLE | NOT_APPLICABLE |
| Compared baseline | Start main SHA | Pass-1 main SHA |
| Relevant paths / critical paths | none / none | none / none |
| Classification | IRRELEVANT: empty upstream delta, SAME history | IRRELEVANT: empty upstream delta, SAME history |
| Reconciliation actions | none needed | none needed |
| Verification | Foundation PASS; all 48 tooling tests PASS; diff check PASS; unchanged application/schema/contract/reference diff | No new upstream delta requiring affected tests; final evidence/link verification PASS before publication |

Commands: `python3 scripts/check_upstream_drift.py --base cd4477f185c159e18ed939a20145865d665099b4 --upstream origin/main --pass-number 1 --format json`, then separately after Pass-1 verification and a second successful fetch, the same command with `--pass-number 2`. Both returned the recorded exact SHA and empty changed/critical paths. No arbitrary peer branch was imported. The candidate already contains this main base.

Final freshness status: **FRESH_2**. Pass 3: **NOT PERMITTED / NOT RUN**. Known post-cutoff risk: later main/authority/dependency changes belong to the integration editor and final human review; no claim of indefinite freshness. CI observes candidate/head state without restarting autonomous upstream reconciliation.

Delivery status at this evidence commit: IMPLEMENTED / PUBLISHED checkpoint, final-head CI verification in progress, REVIEW PENDING. The external #40 handoff records final-head CI and READY_FOR_INTEGRATION only after required checks succeed. Team-wide activation remains pending reviewed R1 merge. No self-approval.

Completed adoption tasks: 26-pass recovery, source reconciliation, ADR/policy, three owned queues and handoffs, contributor CI, bounded helper, A–E simulations, six role prompts, metadata mapping, two final passes. Remaining: exact final-head CI and independent human review/authorized merge; later product tasks are not executed by this assignment. Remote effects are GitHub commits/ref updates, draft/PR/issue metadata and CI only; no application/order/payment/migration/email operations occurred. New migrations/contracts: none. Architectural process decision: ADR-012 only.

Next exact action: verify final #40 CI, have Ben review both the preserved CORE-01 implementation and separate workflow commits at the final head, then have the designated authority integrate. After merge, use `docs/ai/transition/README.md`; WS1 continues R4 preparation, WS2 BR-01/R2, WS3 CORE-02/R2 under the ledger. Do not copy unaccepted peer branches or bypass runtime gates.
