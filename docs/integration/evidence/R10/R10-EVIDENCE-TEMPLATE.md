# R10 execution evidence template

Use one copy of this template per qualification/rehearsal event. Do not overwrite prior evidence after an external effect has occurred.

## Identity

- Evidence ID:
- Qualification matrix IDs:
- Date/time UTC:
- Operator:
- Reviewer:
- Exact repository SHA:
- Branch / PR:
- App build ID:
- Environment:
- Deployment URL:
- WordPress/Woo bridge version where relevant:
- Supabase/project identifier (non-secret) where relevant:
- Device/browser/OS where relevant:
- Related follow-up issues (#82–#88) if observed:

## Authorization

- Remote writes authorized? YES / NO
- Payment mode: none / fake / TEST / LIVE
- Live money authorized? YES / NO
- Refund/restock authorized? YES / NO
- Production authorized? YES / NO
- VitePOS change authorized? YES / NO
- Human approval reference:

If the required authorization is absent, record **BLOCKED** and do not execute the effect.

## Preconditions

Record only observed facts.

- staff/session:
- register/shift:
- product/customer fixture:
- stock before:
- quote before:
- pending operations before:
- VitePOS queue/shift state where relevant:
- containment/notification state where relevant:
- backup/snapshot identifiers where relevant:

## Procedure

1.
2.
3.

For failure injection, identify exactly where the failure occurs relative to the external effect.

## Expected result

-

## Observed result

-

## Durable identifiers

Do not include secrets or unnecessary PII.

- POS transaction ID:
- sale ID:
- Woo order ID:
- idempotency key/reference (sanitized where appropriate):
- payment reference (sanitized):
- return/refund/effect ID:
- shift/Z-report ID:
- correlation ID:

## Exactly-once / recovery checks

- order count/effect delta:
- payment/tender delta:
- stock delta:
- refund delta:
- receipt count:
- replay behavior:
- resolve-before-retry behavior:
- post-restart behavior where relevant:

## Evidence

- CI/workflow run:
- test command/result:
- screenshot/video:
- server/application log reference:
- Woo/Supabase/provider evidence:
- device evidence:
- redaction review:

## Cleanup / retained effects

State exactly what was retained, restored or reversed. Code rollback does not reverse a payment, order, stock change, refund, email or other external effect.

## Result

Choose exactly one:

- PASS
- FAIL
- BLOCKED
- NOT_RUN

Reason:

## Follow-up

- unresolved risk:
- owner:
- next exact action:
- release capability affected:
