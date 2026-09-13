# CP04-W3 synthetic fixtures for R2 bridge health

Observer: WS3 senior / @wbdevworld  
UTC: `2026-09-13T00:05:00Z` (plan only; no records created)  
Host: `https://training.cetechbpa.com` (confirmed; W4 not executed)

Health acceptance does **not** require a customer order.

**No commerce/customer fixture required for CP04-W4 health acceptance.**  
Customer/order fixtures created: **NO**  
PII copied: **NO**  
Production customers/orders exported: **NO**

## Proposed identities (not created)

| Item | Proposed value | Status |
| --- | --- | --- |
| Dedicated bridge username | `cetech-pos-bridge-svc` | PROPOSED; must not be created until W4 Action C is explicitly authorized |
| WordPress base role | least-privilege role that can authenticate and hold an Application Password (typically a custom/subscriber-class role, **not** administrator, cashier, or customer) | PROPOSED |
| Dedicated capability | `cetech_pos_bridge_access` only | frozen BR-01 |
| Application Password label | `cetech-pos-bff-r2-health` | PROPOSED; never commit the secret |
| Operator-approved non-customer test email/sink | **not established** (blocked by W1) | PERMISSION_REQUIRED |

Do not use an administrator, human cashier, buyer/customer, or Supabase service-role credential as the BFF service identity.

## Correlation UUID examples (synthetic)

Valid request ID (must be echoed on success):

`550e8400-e29b-41d4-a716-446655440000`

Malformed inbound (bridge should reject; must not echo as success):

`not-a-uuid`

Missing header: omit `X-Correlation-ID`.

These are fixtures, not live traffic.

## Request fixtures (not sent)

Positive (only after capability grant):

- `GET /wp-json/cetech-pos/v1/health`
- Header `X-Correlation-ID: 550e8400-e29b-41d4-a716-446655440000`
- Header `Authorization: Basic` using the **runtime** Application Password (never logged)
- Header `Accept: application/json`

Negative:

1. Same GET, no `Authorization` → expected 401 `AUTH_REQUIRED`
2. Basic auth for the dedicated user **before** `cetech_pos_bridge_access` → expected 403 `FORBIDDEN`
3. Valid auth + missing/malformed correlation → expected 400 `VALIDATION_ERROR` with a **new** UUID (not an echo of garbage)

## Redaction rules

Never commit or paste:

- Application Password secret
- WordPress passwords
- `BRIDGE_APPLICATION_PASSWORD`
- Supabase service-role keys
- customer names, emails, phones, order payloads
- SMTP/MailPoet API keys
- database URLs/credentials

Safe to record: HTTP status, capability name, username **if** non-secret policy allows, numeric user ID, Application Password **label/id**, correlation UUID used, detection booleans, `pricingParityVerified=false`.

## Server-only BFF names (R2 composition; do not put in `NEXT_PUBLIC_*`)

- `BRIDGE_BASE_URL`
- `BRIDGE_USERNAME`
- `BRIDGE_APPLICATION_PASSWORD`

Never create `NEXT_PUBLIC_BRIDGE_USERNAME` or `NEXT_PUBLIC_BRIDGE_APPLICATION_PASSWORD`.

CP04-W3 = **PASS** as a fixture **plan**. No WordPress user was created.
