-- Shared JWT claim helpers for RLS tests. The executable suite is test_rls_isolation.sql.

CREATE OR REPLACE FUNCTION pos_test_set_claims(
  p_org text,
  p_locs text[],
  p_actor text,
  p_register text
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'role', 'authenticated',
      'sub', '00000000-0000-4000-8000-000000000001',
      'app_metadata', json_build_object(
        'organization_id', p_org,
        'location_ids', to_jsonb(p_locs),
        'actor_id', p_actor,
        'register_id', p_register
      )
    )::text,
    true
  );
END;
$$;

CREATE OR REPLACE FUNCTION pos_test_clear_claims() RETURNS void
LANGUAGE sql
AS $$
  SELECT set_config('request.jwt.claims', '{}', true);
$$;
