-- Additive prepare-intent capture. Not an acknowledged outcome and not a fabricated sale.
-- sale.prepare stores sale-time presentation here BEFORE SalesPort.prepare.

ALTER TABLE pos_pending_operations
  ADD COLUMN IF NOT EXISTS intent_snapshot jsonb;

COMMENT ON COLUMN pos_pending_operations.intent_snapshot IS
  'Pre-effect command intent bound to organization/operation/idempotency_key/request_hash/scope. For sale.prepare this is the immutable sale-time presentation captured before the first commercial side effect. Not outcome, not a fabricated PreparedSale, and not current catalog state.';
