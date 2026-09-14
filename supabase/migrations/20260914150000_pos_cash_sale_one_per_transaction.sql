-- CORE-05: one net cash_sale ledger effect per commercial transaction.
-- Authenticated clients still cannot insert cash_sale; trusted-server insert only.

CREATE UNIQUE INDEX pos_cash_one_sale_per_transaction
  ON pos_cash_movements (organization_id, transaction_id)
  WHERE kind = 'cash_sale' AND transaction_id IS NOT NULL;

COMMENT ON INDEX pos_cash_one_sale_per_transaction IS
  'CORE-05: the same cash command yields one net cash_sale movement per transaction. Duplicate inserts fail closed. Trusted-server write; not a second commercial sale.';
