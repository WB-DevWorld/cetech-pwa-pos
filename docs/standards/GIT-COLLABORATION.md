# Git collaboration standard

[ADR-012](../decisions/ADR/012.md) refines ADR-007's cadence. Follow the canonical [long-running policy](../plans/LONG-RUNNING-WORK.md): small tasks, frequent commits, approved continuation queues, isolated contributor worktrees, declared-commit milestone assembly and one milestone PR. Main remains canonical; temporary batch branches expire. No permanent develop/qa/uat tree.

Only the integration editor combines declared commits; central ownership remains serialized. Never blindly merge peer branches or rewrite published history to look current. Before final delivery record exactly two freshness passes, the tested combination and final head. The second upstream SHA is the cutoff, not perpetual freshness. Later drift belongs to integration/review or a new session.

Architecture review and code correctness are distinct. Senior-authored changes require another human. CODEOWNERS is review routing, not a file ACL. Preserve required checks and protections; full live settings require an authorized read. Ten remaining closures is a budget; split unsafe review scope. Owner: WS3. Done = evidence.
