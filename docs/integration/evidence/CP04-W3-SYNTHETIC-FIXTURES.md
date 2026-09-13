# CP04-W3 synthetic fixtures for R2 bridge health

Observer: WS3 senior / @wbdevworld  
UTC: `2026-09-13T00:05:00Z` (plan); identities created in authorized W4 `2026-09-13T06:22:23Z`
Host: `https://training.cetechbpa.com`

Health acceptance does **not** require a customer order.

**No commerce/customer fixture required for CP04-W4 health acceptance.**  
Customer/order fixtures created: **NO**  
PII copied: **NO**  
Production customers/orders exported: **NO**

## Identities

| Item | Value | Status |
| --- | --- | --- |
| Dedicated bridge username | `cetech-pos-bridge-svc` (ID 22) | CREATED in W4 |
| WordPress base role | subscriber | CREATED |
| Dedicated capability | `cetech_pos_bridge_access` only | GRANTED in W4 Action F |
| Application Password label | `cetech-pos-bff-r2-health` uuid `6bd36d36-1da6-424f-af0f-d54809f78bd5` | CREATED; secret not committed |
| Operator-approved non-customer test email/sink | `cp04-w1-sink@training.invalid` plus host-local capture | PASS via W1 |

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

CP04-W3 = **PASS**. No commerce/customer fixtures. Service identity created only in authorized W4.
