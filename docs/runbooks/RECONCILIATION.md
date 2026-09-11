# Reconciliation runbook

For timeout/unknown operation: keep transaction/key, show checking/needs-attention, resolve server workflow and authoritative provider/order mapping. Never create a new transaction/tender to clear a spinner.

Compare POS transaction → Woo order → payment evidence/provider → stock effect → cash ledger → receipt. Repair missing projections/receipt/outbox only after authoritative outcome established. Payment verified but Woo incomplete: repeat idempotent finalizer. Woo complete but POS missing: reconstruct linked POS state and unique receipt; no new payment. Unknown provider payment: query provider, retain commitment or escalate; no cancellation/restock until definitive outcome. Late success after cancellation: attention and approved refund handling.

Shift invariants: one active/closing shift per register, one cash-sale movement per cash tender, immutable variance and Z. Returns: one provider refund per refund intent, separate one stock effect per approved disposition. Escalate discrepancies with redacted correlation/transaction IDs; do not paste credentials/PII. Record operator, evidence, repair decision and time.
