-- Synthetic fixtures only. No training-site customers, orders, or PII.

INSERT INTO pos_organizations (id, name) VALUES
  ('org_a', 'Org A'),
  ('org_b', 'Org B');

INSERT INTO pos_locations (id, organization_id, name) VALUES
  ('loc_a1', 'org_a', 'Location A1'),
  ('loc_a2', 'org_a', 'Location A2'),
  ('loc_b1', 'org_b', 'Location B1');

INSERT INTO pos_devices (id, organization_id, location_id, label, status) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'org_a', 'loc_a1', 'Device A', 'active');

INSERT INTO pos_registers (id, organization_id, location_id, name, currency, status) VALUES
  ('reg_a', 'org_a', 'loc_a1', 'Register A', 'GHS', 'active'),
  ('reg_b', 'org_a', 'loc_a2', 'Register B', 'GHS', 'active');

INSERT INTO pos_staff_location_assignments (actor_id, organization_id, location_id, role) VALUES
  ('cashier_a', 'org_a', 'loc_a1', 'cashier'),
  ('manager_a', 'org_a', 'loc_a1', 'manager'),
  ('manager_a', 'org_a', 'loc_a2', 'manager');

INSERT INTO pos_staff_register_assignments (actor_id, organization_id, location_id, register_id) VALUES
  ('cashier_a', 'org_a', 'loc_a1', 'reg_a'),
  ('manager_a', 'org_a', 'loc_a1', 'reg_a'),
  ('manager_a', 'org_a', 'loc_a2', 'reg_b');
