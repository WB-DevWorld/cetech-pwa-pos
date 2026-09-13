# Ownership and serialization

| Workstream | Human | Owns |
| --- | --- | --- |
| WS1 Frontend / UX | Developer 1 — @Ben-001-sys (write access verified 2026-09-12) | apps/pos-web/src/features/**, apps/pos-web/src/ui/**, tests/frontend/** |
| WS2 Commerce Bridge | Developer 2 — @Emmanuel-coder-prog (write access verified 2026-09-12) | wordpress/cetech-pos-bridge/**, tests/bridge/**, tests/fixtures/commerce/** |
| WS3 Core / Data / Integration | Senior/user, connected GitHub account @wbdevworld (admin verified) | apps/pos-web/src/core/**, src/server/**, src/config/**, src/app/**, src/local/**, public/**, supabase/**, scripts/**, docs/**, .github/**, .cursor/**, reference/**, integration tests and root files |

All application paths in the WS3 row are relative to apps/pos-web. WS1/WS2 own their workstream status/handoff/task evidence documents; WS3 owns cross-workstream plans and contract decisions. A task may delegate a named path for a bounded interval; record editor, branch and release of ownership in CURRENT-WORK.md.

## Central single-editor list
WS3 owns schema/generated domain types, operation and state-machine definitions, migrations, package.json, pnpm-lock.yaml, pnpm-workspace.yaml if later justified, environment schema, CI, CODEOWNERS, AGENTS.md, source authority, ADR register, service worker, Dexie schema, app routing and release config. UI changes request integration edits rather than competing on these files.

The default CODEOWNERS fallback is @wbdevworld for shared/root files; explicit WS1 and WS2 paths route to the verified developers above. GitHub uses the last matching pattern, so repeated `*` lines do not accumulate owners. Tests/tooling is WS3 repository tooling. CODEOWNERS routes review only when supported/enforced; it does not grant access or prevent file edits. One owner approving is not equivalent to both technical and architecture review. Senior-authored changes need another human reviewer; the author cannot self-approve a PR. Set a verified backup reviewer before enforcing owner review.

Only the senior integrates main. Human role names do not authorize invitations to guessed identities. Both developer write permissions and the senior admin permission were verified through GitHub on 2026-09-12. Backup architecture reviewer designation remains UNVERIFIED.

## R1 workflow adoption and batch ownership

Senior/user's 2026-09-12 instruction authorizes one WS3 governance/tooling editor on PR #40: AGENTS/CONTRIBUTING/SOURCE-OF-TRUTH/OWNERSHIP/CURRENT-WORK, docs plans/standards/decisions/AI/source manifest, all three workstream policy/queue/status/handoff documents, .cursor rules, PR template, CI contributor triggers, drift helper and its tooling tests. Existing CORE-01 SQL/schema/tests are preserved by this adoption task. Other workstreams do not gain central edit rights. Lease and review state live in CURRENT-WORK.

@Ben-001-sys is requested as the different human R1 reviewer (already requested on #40); approval remains pending until actually recorded for the final head. Backup architecture reviewer remains UNVERIFIED. Review routing/participation is not permission to self-approve. Milestone assembly does not grant the union of contributor paths to every agent.
