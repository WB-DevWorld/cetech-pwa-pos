-- DB-SEC-01 catalog assertions. Not the mirrored RLS suite.
-- Synthetic privileges only. No staging connection and no remote DDL.

BEGIN;

SELECT plan(28);

SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_cash_movements', 'TRUNCATE'), 'authenticated lacks TRUNCATE on pos_cash_movements');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_devices', 'TRUNCATE'), 'authenticated lacks TRUNCATE on pos_devices');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_integration_watermarks', 'TRUNCATE'), 'authenticated lacks TRUNCATE on pos_integration_watermarks');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_locations', 'TRUNCATE'), 'authenticated lacks TRUNCATE on pos_locations');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_organizations', 'TRUNCATE'), 'authenticated lacks TRUNCATE on pos_organizations');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_outbox_events', 'TRUNCATE'), 'authenticated lacks TRUNCATE on pos_outbox_events');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_pending_operations', 'TRUNCATE'), 'authenticated lacks TRUNCATE on pos_pending_operations');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_registers', 'TRUNCATE'), 'authenticated lacks TRUNCATE on pos_registers');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_shifts', 'TRUNCATE'), 'authenticated lacks TRUNCATE on pos_shifts');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_staff_location_assignments', 'TRUNCATE'), 'authenticated lacks TRUNCATE on pos_staff_location_assignments');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_staff_register_assignments', 'TRUNCATE'), 'authenticated lacks TRUNCATE on pos_staff_register_assignments');

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

SELECT ok(
  has_table_privilege('authenticated', 'public.pos_organizations', 'TRUNCATE'),
  'hosted-default reproduction grants authenticated TRUNCATE before the repair'
);

REVOKE TRUNCATE ON TABLE
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
FROM PUBLIC, anon, authenticated;

SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_cash_movements', 'TRUNCATE'), 'repair removes TRUNCATE on pos_cash_movements');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_devices', 'TRUNCATE'), 'repair removes TRUNCATE on pos_devices');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_integration_watermarks', 'TRUNCATE'), 'repair removes TRUNCATE on pos_integration_watermarks');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_locations', 'TRUNCATE'), 'repair removes TRUNCATE on pos_locations');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_organizations', 'TRUNCATE'), 'repair removes TRUNCATE on pos_organizations');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_outbox_events', 'TRUNCATE'), 'repair removes TRUNCATE on pos_outbox_events');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_pending_operations', 'TRUNCATE'), 'repair removes TRUNCATE on pos_pending_operations');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_registers', 'TRUNCATE'), 'repair removes TRUNCATE on pos_registers');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_shifts', 'TRUNCATE'), 'repair removes TRUNCATE on pos_shifts');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_staff_location_assignments', 'TRUNCATE'), 'repair removes TRUNCATE on pos_staff_location_assignments');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_staff_register_assignments', 'TRUNCATE'), 'repair removes TRUNCATE on pos_staff_register_assignments');

SELECT ok(has_table_privilege('authenticated', 'public.pos_organizations', 'SELECT'), 'organizations SELECT remains');
SELECT ok(has_table_privilege('authenticated', 'public.pos_shifts', 'INSERT'), 'shifts INSERT remains');
SELECT ok(has_table_privilege('authenticated', 'public.pos_cash_movements', 'INSERT'), 'cash movement INSERT remains');
SELECT ok(has_table_privilege('authenticated', 'public.pos_pending_operations', 'INSERT'), 'pending operation INSERT remains');
SELECT ok(
  has_table_privilege('authenticated', 'public.pos_organizations', 'UPDATE'),
  'hosted UPDATE remains after the minimum TRUNCATE revoke and is a separate decision'
);
SELECT ok(NOT has_table_privilege('anon', 'public.pos_organizations', 'TRUNCATE'), 'anon still lacks TRUNCATE');

SELECT finish();
ROLLBACK;
