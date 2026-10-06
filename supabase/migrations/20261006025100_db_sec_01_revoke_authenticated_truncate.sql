-- DB-SEC-01
-- The operational schema revokes table privileges from PUBLIC and anon, then
-- grants selected privileges to authenticated. It does not revoke authenticated.
-- A hosted default ALL grant therefore remains, and TRUNCATE bypasses RLS.
-- This statement removes only TRUNCATE. SELECT, INSERT, UPDATE, DELETE, and
-- service_role grants are left unchanged. Default privileges for future tables
-- are not changed here because the granting role was not in the catalog extract.

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
