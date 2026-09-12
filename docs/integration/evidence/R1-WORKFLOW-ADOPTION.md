# R1 workflow adoption evidence

Scope: senior-authorized governance/tooling addition to existing PR #40. Starting main `cd4477f185c159e18ed939a20145865d665099b4`; starting R1 implementation `860bef52efb53773788f6e06fc1753d8d51670a9`. Starting R4/#41 `ede771bdbe5f05c8b517ce5168c9d8515a354e28`, still preparation with CORE-04 runtime gate. User authorization explicitly expands R1 scope; [scope notice](https://github.com/WB-DevWorld/cetech-pwa-pos/pull/40#issuecomment-5648240556) recorded before edits.

Main protections: branch summary protected=true, required control-plane/control-plane-windows; rulesets list empty. Full classic protection GET denied 403, therefore full settings UNVERIFIED. No protections changed. Ben remains the requested different human reviewer; no self-approval or merge.

Design: ADR-012, canonical LONG-RUNNING-WORK policy, ten milestone mapping, current queues, six role prompts, contributor push CI, read-only drift helper. Existing CORE-01 SQL/schema/RLS, domain contracts, application, bridge, immutable prototype, package/lockfiles are outside this adoption edit.

Validation and final freshness are recorded below as execution completes. Any unrecorded check is UNVERIFIED, not PASS. The final commit SHA is supplied in the PR handoff to avoid self-reference.

## Controlled freshness scenarios

The tooling tests create temporary real Git repositories. A: unrelated documentation delta is reported without checkout/code edits. B: additive contract fixture is surfaced and an explicit consumer compatibility assertion is rerun. C: a contract-owner change is surfaced without editing it. D: a new authority change between snapshots appears only in Pass 2. E: a post-cutoff commit leaves the recorded cutoff unchanged and a third-pass helper invocation is rejected.

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
