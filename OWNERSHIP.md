# Ownership and serialization

| Workstream | Human | Owns |
| --- | --- | --- |
| WS1 Frontend / UX | Developer 1 — GitHub identity UNVERIFIED | apps/pos-web/src/features/**, apps/pos-web/src/ui/**, tests/frontend/** |
| WS2 Commerce Bridge | Developer 2 — GitHub identity UNVERIFIED | wordpress/cetech-pos-bridge/**, tests/bridge/**, tests/fixtures/commerce/** |
| WS3 Core / Data / Integration | Senior/user, connected GitHub account @wbdevworld (admin verified) | apps/pos-web/src/core/**, src/server/**, src/config/**, src/app/**, src/local/**, public/**, supabase/**, scripts/**, docs/**, .github/**, .cursor/**, reference/**, integration tests and root files |

All application paths in the WS3 row are relative to apps/pos-web. WS1/WS2 own their workstream status/handoff/task evidence documents; WS3 owns cross-workstream plans and contract decisions. A task may delegate a named path for a bounded interval; record editor, branch and release of ownership in CURRENT-WORK.md.

## Central single-editor list
WS3 owns schema/generated domain types, operation and state-machine definitions, migrations, package.json, pnpm-lock.yaml, pnpm-workspace.yaml if later justified, environment schema, CI, CODEOWNERS, AGENTS.md, source authority, ADR register, service worker, Dexie schema, app routing and release config. UI changes request integration edits rather than competing on these files.

The default CODEOWNERS fallback is @wbdevworld until colleague accounts are verified. Comments are assignment placeholders, not working GitHub owners. CODEOWNERS routes review only when supported/enforced; it does not grant access or prevent file edits. One owner approving is not equivalent to both technical and architecture review. Senior-authored changes need another human reviewer; the author cannot self-approve a PR. Set a verified backup reviewer before enforcing owner review.

Only the senior integrates main. Human role names do not authorize invitations to guessed identities. Colleague access/identity assignment remains an explicit setup action.
