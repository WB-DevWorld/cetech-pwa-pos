-- DB-SEC-01
-- The operational schema revokes table privileges from PUBLIC and anon, then
-- grants selected privileges to authenticated. It does not revoke authenticated.
-- A hosted default ALL grant therefore remains, and TRUNCATE bypasses RLS.
-- This removes only TRUNCATE. SELECT, INSERT, UPDATE, DELETE, and service_role
-- grants are left unchanged. Default privileges for future tables are not
-- changed here because the granting role was not in the catalog extract.
-- The function lets a disposable test reproduce the unwanted grant and then
-- apply this same repair. Application rollback must not grant TRUNCATE back.

CREATE OR REPLACE FUNCTION public.db_sec_01_revoke_authenticated_truncate()
RETURNS void
LANGUAGE sql
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.db_sec_01_revoke_authenticated_truncate()
  FROM PUBLIC, anon, authenticated;

-- Reproduce the hosted TRUNCATE grant inside this same migration transaction,
-- then let the statement below remove it. The committed result is the revoke.
-- A runner that drops only that invocation leaves the reproduced privilege.

GRANT TRUNCATE ON TABLE
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

SELECT public.db_sec_01_revoke_authenticated_truncate();
