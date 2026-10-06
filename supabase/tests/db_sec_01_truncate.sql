-- DB-SEC-01 catalog assertions. Not the mirrored RLS suite.
-- Synthetic privileges only. No staging connection and no remote DDL.
-- The shipping migration does not grant TRUNCATE. This test does not call
-- the helper. The disposable replay proof seeds the grant and applies the
-- migration file outside this suite, including a copy that omits only the
-- final invocation. The savepoint below shows that an omitted call leaves
-- the seeded privilege; it is not that modified-migration run.

BEGIN;

SELECT plan(24);

SELECT ok(
  to_regprocedure('public.db_sec_01_revoke_authenticated_truncate()') IS NOT NULL,
  'migration installs the TRUNCATE repair function'
);

SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_cash_movements', 'TRUNCATE'), 'runner invocation removes effective TRUNCATE on pos_cash_movements');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_devices', 'TRUNCATE'), 'runner invocation removes effective TRUNCATE on pos_devices');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_integration_watermarks', 'TRUNCATE'), 'runner invocation removes effective TRUNCATE on pos_integration_watermarks');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_locations', 'TRUNCATE'), 'runner invocation removes effective TRUNCATE on pos_locations');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_organizations', 'TRUNCATE'), 'runner invocation removes effective TRUNCATE on pos_organizations');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_outbox_events', 'TRUNCATE'), 'runner invocation removes effective TRUNCATE on pos_outbox_events');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_pending_operations', 'TRUNCATE'), 'runner invocation removes effective TRUNCATE on pos_pending_operations');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_registers', 'TRUNCATE'), 'runner invocation removes effective TRUNCATE on pos_registers');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_shifts', 'TRUNCATE'), 'runner invocation removes effective TRUNCATE on pos_shifts');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_staff_location_assignments', 'TRUNCATE'), 'runner invocation removes effective TRUNCATE on pos_staff_location_assignments');
SELECT ok(NOT has_table_privilege('authenticated', 'public.pos_staff_register_assignments', 'TRUNCATE'), 'runner invocation removes effective TRUNCATE on pos_staff_register_assignments');

SAVEPOINT omit_invocation;
GRANT TRUNCATE ON TABLE public.pos_organizations TO authenticated;
SELECT ok(
  has_table_privilege('authenticated', 'public.pos_organizations', 'TRUNCATE'),
  'omitting the automatic invocation leaves effective TRUNCATE'
);
ROLLBACK TO SAVEPOINT omit_invocation;

SELECT ok(
  NOT has_function_privilege('anon', 'public.db_sec_01_revoke_authenticated_truncate()', 'EXECUTE'),
  'anon lacks effective EXECUTE on the repair function'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.db_sec_01_revoke_authenticated_truncate()', 'EXECUTE'),
  'authenticated lacks effective EXECUTE on the repair function'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid = 'public.db_sec_01_revoke_authenticated_truncate()'::regprocedure
      AND proacl IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_proc AS repair_fn, aclexplode(repair_fn.proacl) AS acl
    WHERE repair_fn.oid = 'public.db_sec_01_revoke_authenticated_truncate()'::regprocedure
      AND acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'
  ),
  'PUBLIC has no EXECUTE grant; a null proacl would be the default PUBLIC EXECUTE'
);

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
  position('REVOKE UPDATE' in pg_get_functiondef('public.db_sec_01_revoke_authenticated_truncate()'::regprocedure)) = 0
  AND position('REVOKE TRUNCATE' in pg_get_functiondef('public.db_sec_01_revoke_authenticated_truncate()'::regprocedure)) > 0,
  'repair function revokes TRUNCATE and does not revoke UPDATE'
);
SELECT ok(NOT has_table_privilege('anon', 'public.pos_organizations', 'TRUNCATE'), 'anon still lacks TRUNCATE');

SELECT finish();
ROLLBACK;
