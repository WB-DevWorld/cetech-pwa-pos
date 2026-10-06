-- DB-SEC-01 catalog assertions. Not the mirrored RLS suite.
-- Synthetic privileges only. No staging connection and no remote DDL.
-- The unwanted grant is reproduced before the migration function removes it.
-- A no-op migration leaves the reproduced TRUNCATE in place and fails.

BEGIN;

SELECT plan(31);

SELECT ok(
  to_regprocedure('public.db_sec_01_revoke_authenticated_truncate()') IS NOT NULL,
  'migration installs the TRUNCATE repair function'
);

GRANT ALL ON TABLE
  public.pos_cash_movements,
  public.pos_devices,
  public.pos_integration_watermarks,
  public.pos_locations,
  public.pos_organizations,
  public.pos_outbox_events,
  public.pos_pending_operations,
  public.pos_registers,
  public.pos_shifts,
  public.pos_staff_location_assignments,
  public.pos_staff_register_assignments
TO authenticated;

SELECT ok(has_table_privilege('authenticated', 'public.pos_cash_movements', 'TRUNCATE'), 'reproduced TRUNCATE on pos_cash_movements before repair');
SELECT ok(has_table_privilege('authenticated', 'public.pos_devices', 'TRUNCATE'), 'reproduced TRUNCATE on pos_devices before repair');
SELECT ok(has_table_privilege('authenticated', 'public.pos_integration_watermarks', 'TRUNCATE'), 'reproduced TRUNCATE on pos_integration_watermarks before repair');
SELECT ok(has_table_privilege('authenticated', 'public.pos_locations', 'TRUNCATE'), 'reproduced TRUNCATE on pos_locations before repair');
SELECT ok(has_table_privilege('authenticated', 'public.pos_organizations', 'TRUNCATE'), 'reproduced TRUNCATE on pos_organizations before repair');
SELECT ok(has_table_privilege('authenticated', 'public.pos_outbox_events', 'TRUNCATE'), 'reproduced TRUNCATE on pos_outbox_events before repair');
SELECT ok(has_table_privilege('authenticated', 'public.pos_pending_operations', 'TRUNCATE'), 'reproduced TRUNCATE on pos_pending_operations before repair');
SELECT ok(has_table_privilege('authenticated', 'public.pos_registers', 'TRUNCATE'), 'reproduced TRUNCATE on pos_registers before repair');
SELECT ok(has_table_privilege('authenticated', 'public.pos_shifts', 'TRUNCATE'), 'reproduced TRUNCATE on pos_shifts before repair');
SELECT ok(has_table_privilege('authenticated', 'public.pos_staff_location_assignments', 'TRUNCATE'), 'reproduced TRUNCATE on pos_staff_location_assignments before repair');
SELECT ok(has_table_privilege('authenticated', 'public.pos_staff_register_assignments', 'TRUNCATE'), 'reproduced TRUNCATE on pos_staff_register_assignments before repair');

SELECT public.db_sec_01_revoke_authenticated_truncate();

SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_cash_movements', 'TRUNCATE'), 'repair removes effective TRUNCATE on pos_cash_movements');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_devices', 'TRUNCATE'), 'repair removes effective TRUNCATE on pos_devices');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_integration_watermarks', 'TRUNCATE'), 'repair removes effective TRUNCATE on pos_integration_watermarks');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_locations', 'TRUNCATE'), 'repair removes effective TRUNCATE on pos_locations');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_organizations', 'TRUNCATE'), 'repair removes effective TRUNCATE on pos_organizations');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_outbox_events', 'TRUNCATE'), 'repair removes effective TRUNCATE on pos_outbox_events');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_pending_operations', 'TRUNCATE'), 'repair removes effective TRUNCATE on pos_pending_operations');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_registers', 'TRUNCATE'), 'repair removes effective TRUNCATE on pos_registers');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_shifts', 'TRUNCATE'), 'repair removes effective TRUNCATE on pos_shifts');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_staff_location_assignments', 'TRUNCATE'), 'repair removes effective TRUNCATE on pos_staff_location_assignments');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_staff_register_assignments', 'TRUNCATE'), 'repair removes effective TRUNCATE on pos_staff_register_assignments');

SELECT ok(has_table_privilege('authenticated', 'public.pos_organizations', 'SELECT'), 'organizations SELECT remains');
SELECT ok(has_table_privilege('authenticated', 'public.pos_shifts', 'INSERT'), 'shifts INSERT remains');
SELECT ok(has_table_privilege('authenticated', 'public.pos_cash_movements', 'INSERT'), 'cash movement INSERT remains');
SELECT ok(has_table_privilege('authenticated', 'public.pos_pending_operations', 'INSERT'), 'pending operation INSERT remains');
SELECT ok(has_table_privilege('service_role', 'public.pos_organizations', 'SELECT'), 'service_role organizations SELECT remains');
SELECT ok(
  has_function_privilege('authenticated', 'public.pos_lock_shift_topology(text,uuid)', 'EXECUTE'),
  'authenticated shift-topology RPC execute remains'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.pos_organizations', 'UPDATE'),
  'hosted UPDATE remains after the minimum TRUNCATE revoke and is a separate decision'
);
SELECT ok(NOT has_table_privilege('anon', 'public.pos_organizations', 'TRUNCATE'), 'anon still lacks TRUNCATE');

SELECT finish();
ROLLBACK;
