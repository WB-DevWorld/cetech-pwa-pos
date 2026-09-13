-- CORE-02 durable staff sessions.
-- CORE-01 operational tables cannot store HttpOnly staff sessions:
-- they are tenant commerce/workflow rows, not a JWT session cache, and
-- pos_pending_operations is command idempotency rather than authentication.
-- No FK to pos_organizations/staff: login must not require a seeded org row.
-- service_role is infrastructure access for the BFF store, not cashier authorization.

CREATE TABLE pos_staff_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id pos_id NOT NULL,
  actor_id pos_id NOT NULL,
  csrf_token text NOT NULL CHECK (char_length(csrf_token) BETWEEN 1 AND 128),
  session_payload jsonb NOT NULL CHECK (
    jsonb_typeof(session_payload) = 'object'
    AND session_payload ? 'actorId'
    AND session_payload ? 'organizationId'
    AND session_payload ? 'expiresAt'
  ),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pos_staff_sessions_expires_idx ON pos_staff_sessions (expires_at);
CREATE INDEX pos_staff_sessions_actor_idx ON pos_staff_sessions (organization_id, actor_id);

COMMENT ON TABLE pos_staff_sessions IS
  'Durable BFF staff-session cache. Session id is server-managed. Browser JS must not see the session secret. anon/authenticated have no access. service_role is infrastructure, not business authorization. Sign-out does not clear Dexie drafts/journal.';

ALTER TABLE pos_staff_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE pos_staff_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE pos_staff_sessions TO service_role;
