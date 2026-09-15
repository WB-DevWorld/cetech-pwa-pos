-- R6-REM-02: one durable sale.prepare scope binding per transaction.
-- Additive. Remote Woo resolve is allowed only after this local binding exists.
-- Not a Woo order/customer/product master.

CREATE UNIQUE INDEX IF NOT EXISTS pos_pending_one_prepare_per_transaction
  ON pos_pending_operations (transaction_id)
  WHERE operation = 'sale.prepare' AND transaction_id IS NOT NULL;

COMMENT ON INDEX pos_pending_one_prepare_per_transaction IS
  'R6-REM-02: organization-scoped prepare identity is still (organization_id, operation, idempotency_key). This unique transaction binding prevents an unbound client transactionId from becoming a Woo resolve oracle.';
