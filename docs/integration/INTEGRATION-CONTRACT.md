# Cross-workstream integration contract

One schema/version/error policy; WS3 serializes updates. WS1 provides port-driven feature components and route mounting instructions. WS2 provides authenticated normalized bridge endpoints with actual pricing/stock/idempotency evidence. WS3 provides composition, use cases, POS storage/auth/RLS/local journal and release integration.

A merge handoff includes commit, scopes, endpoint/type versions, fixture provenance, test output and runtime environment. Mock success is labelled synthetic; actual staging parity uses real installed plugin configs. No raw PHP/provider types in React; no UI names dictate bridge implementation. Breaking shared changes merge before consumers. Data migrations run once in order under WS3.

First slice success is one authoritative Woo order, verified tender, one stock effect, immutable receipt and consistent POS record. Failure repair is part of acceptance. No cross-database atomicity claim.
