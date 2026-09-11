# Release and rollback

Use CUTOVER-PLAN.md and RELEASE-GATES.md against one exact artifact/commit. Confirm tests, live configuration, current backups, restore exercise, out-of-band recovery and named release approver. Capture GO/NO-GO with UTC time. Automatic CI/staging is not production approval.

On incident: stop affected new writes through capability kill switch, preserve pending journal/evidence, resolve provider and Woo state, then decide code rollback/forward repair. Do not restore old database over valid new sales. Reconcile cash/stock before reactivating VitePOS for a register. Continue read-only recovery until all pending money/order/refund effects are settled.
