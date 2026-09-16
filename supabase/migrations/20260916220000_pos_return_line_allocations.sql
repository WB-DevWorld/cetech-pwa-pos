-- R8-01: persist the exact preview historic allocation on requested return lines.
-- Additive. Does not rewrite accepted 20260915200000_pos_returns.sql.

ALTER TABLE pos_return_requested_lines
  ADD COLUMN remaining_returnable_quantity numeric(14,6),
  ADD COLUMN allocated_historic_amount_minor pos_money_minor NOT NULL DEFAULT 1,
  ADD COLUMN allocated_historic_currency pos_currency NOT NULL DEFAULT 'GHS';

ALTER TABLE pos_return_requested_lines
  ADD CONSTRAINT pos_return_requested_allocation_positive
  CHECK (allocated_historic_amount_minor > 0);

COMMENT ON COLUMN pos_return_requested_lines.allocated_historic_amount_minor IS
  'Exact preview allocateHistoricMinor result for this requested line. Not the full historic line total.';
