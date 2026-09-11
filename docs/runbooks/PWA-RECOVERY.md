# PWA recovery

1. Diagnose connectivity, current build/API/local schema and pending journal without deleting data.
2. Resume/resolve pending operations with stable keys; reconcile money/order before allowing a fresh tender.
3. Refresh app-owned replaceable resources; rebuild only projections when needed. Preserve drafts/journal/auth.
4. Coordinate tabs and finish/abort-safe schema migration; activate waiting worker only at a safe point.
5. Use lightweight recovery route for broken main bundle; retain compatible old assets/API and prefer rollback/forward repair.

Destructive reset is a last-resort separately approved operation only after protected export/server reconciliation and known data consequences. It is never the ordinary Fix App button. Show clear cashier instructions, not database/provider jargon.
