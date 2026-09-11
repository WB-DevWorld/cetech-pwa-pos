# Error policy

Canonical machine-readable mapping: error-policy.json. Map domain failures consistently; transport timeout is unknown, never a verified failure. nextAction=resolve means inspect existing operation before retry. For read-only unavailability, retry the same read after backoff.

| Code | HTTP | retryable | nextAction |
| --- | --- | --- | --- |
| VALIDATION_ERROR | 400 | false | none |
| AUTH_REQUIRED | 401 | false | reauthenticate |
| FORBIDDEN | 403 | false | none |
| NOT_FOUND | 404 | false | none |
| QUOTE_CHANGED | 409 | false | review_quote |
| QUOTE_EXPIRED | 409 | false | review_quote |
| STOCK_CHANGED | 409 | false | review_quote |
| SHIFT_REQUIRED | 409 | false | contact_manager |
| SHIFT_CONFLICT | 409 | false | resolve |
| PAYMENT_PENDING | 409 | false | resolve |
| PAYMENT_NOT_VERIFIED | 409 | false | resolve |
| INTEGRATION_UNAVAILABLE | 503 | true | resolve |
| IDEMPOTENCY_CONFLICT | 409 | false | contact_manager |
| OPERATION_IN_PROGRESS | 202 | true | resolve |
| REQUIRES_ATTENTION | 409 | false | contact_manager |
| RATE_LIMITED | 429 | true | retry_same_key |
| UNSUPPORTED_VERSION | 426 | false | none |

Unsupported-version UX must preserve local critical data and offer safe update/recovery. Error details are an allowlist of field/operationId/currentQuoteId only. Pending payment errors block new tender, while a successful resolve can return pending state with ok=true.
