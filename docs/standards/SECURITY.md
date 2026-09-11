# Security standard

Privileged Woo/bridge/Supabase/payment/database secrets remain in trusted local/deployment secret settings, never NEXT_PUBLIC/browser bundles/logs/agent prompts. BFF validates authenticated staff scope, CSRF/origin and request schemas on every action. Customer/group, price, actor, totals, approvals and callback status are untrusted. Service-role access bypasses RLS, so server authorization remains mandatory; test it separately. Apply grants plus RLS, least privilege and denied cross-tenant/location cases. Signature/server verification precedes payment/refund evidence. Rate limits protect auth/search/quote; redact PII. Stage with sanitized fixtures; preview has no production write credentials. Critical accounts need independent verified recovery contact and backup admin path outside the service being recovered. Actual accounts/contact values remain live facts.

Owner: WS3. Controlling contracts/ADRs outrank generic examples. Done = evidence.
