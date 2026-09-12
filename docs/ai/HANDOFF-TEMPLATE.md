# Checkpoint and final handoff

Canonical procedure: [long-running policy](../plans/LONG-RUNNING-WORK.md). Use one report with Kind = PROGRESS_CHECKPOINT / SESSION_HANDOFF / TASK_COMPLETION / BATCH_COMPLETION. Routine progress does not run the final protocol. Final delivery requires it; interrupted sessions record missing verification as UNVERIFIED and preserve completed pass numbers.

```text
Kind / UTC:
Task / batch / workstream:
Owner / integration editor / requested human reviewer:
Branch:
Starting/base SHA:
Current/final task head SHA:
Commit(s) / contributor source SHAs:
Allowed / forbidden paths and central leases:
Files changed:
Contracts changed (none/list, version):
Database migrations (none/list):
Architecture decisions (none/list):
Completed/current/remaining tasks:
Dependencies (accepted / provisional SHA / prep-only / blocked):
Tests executed (exact commands, exit codes, counts, evidence):
Runtime verification and tested combined SHA/environment:
Remote effects performed and operation/correlation IDs (no secrets/PII):
Assumptions / limitations / unresolved risks:
Next exact action:

Freshness protocol:
START_FRESHNESS_SNAPSHOT UTC:
Start main SHA:
Start batch ref/SHA, if declared (else NOT_APPLICABLE):
Applicable contracts / ADRs / ownership / queue revision:

Pass 1 fetch UTC / success evidence:
Pass 1 main SHA:
Pass 1 batch SHA:
Relevant upstream paths and dependency/authority effects:
Classification per change:
Actions taken / reconciliation commits:
Tests rerun / tested combined SHA:

Pass 2 fetch UTC / success evidence:
Pass 2 main SHA:
Pass 2 batch SHA:
Relevant upstream paths and dependency/authority effects:
Classification per change:
Actions taken / reconciliation commits:
Tests rerun / tested combined SHA:

Final freshness status (FRESH_2 / RECONCILED_2 / BLOCKED_BY_DRIFT;
UNVERIFIED if interrupted before completing observations):
Delivery status (READY_FOR_INTEGRATION / BLOCKED / INTERRUPTED):
Final task head SHA:
Known post-cutoff risk / integration editor follow-up:
Pass 3: NOT PERMITTED for this assignment.
Review/merge/release status and limitations:
Metrics delta for CURRENT-WORK (counts/timestamps, never guessed zeroes):
```

The final hash cannot be embedded in its own commit: record it in the PR handoff or a later checkpoint. Record pre-handoff implementation SHA in committed evidence. No secrets or unnecessary customer data. No completion claim from prose alone.
