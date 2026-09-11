# VitePOS cutover plan

Status: PLANNED, live facts UNVERIFIED. No deactivation or production promotion has happened.

Before: verify VitePOS stock mode, outlet mappings, all offline pending queues on every device, active shifts/cash, barcode mapping and historical order access. Resolve/sync pending operations before freezing the pilot register. Sanitize/rehearse on a Woo clone; verify actual invoice/tax process and real scanners/printers/payment terminal. Capture backups and demonstrate restore in isolation.

GO requires signed release gates for pricing, stock, payment/refund, RLS, PWA updates, shift/Z, statutory process, hardware, observability and recovery. Record exact commit/build/provider configuration and named human approver/time.

Pilot: freeze the selected register's VitePOS activity; reconcile queues/stock/cash; activate new POS for one approved register with staff training and monitoring. The online Woo store continues; do not run two POS writers on the same register. Compare first sale, shift and invariants. Expand only after healthy operation; permanently remove VitePOS only after multiple healthy shifts and retained rollback path.

Rollback: stop new POS writes, resolve all ambiguous tenders/orders/refunds, retain journal/evidence and real sales, reconcile Woo stock/cash, then return the register to proven VitePOS configuration under human direction. Never restore an old DB over new real transactions or replay old queues blindly. Keep new POS read-only recovery available until all work is settled.
