# Contract change process

WS3 owns schema, ports, errors and state machine. Open an issue with use case, affected owners/paths, current/future providers and compatibility impact. Run pos-architecture-guardian before deciding. Record significant changes in ADR/Register, then update sole schema source, regenerate TS, update OpenAPI paths, mocks and contract fixtures together. Obtain consumer review from WS1 and producer review from WS2; one coordinated WS3 merge precedes dependent work. No temporary parallel shape invented in a feature branch.

Freeze v1.0.0 covers the initial shared slice. Follow-on endpoints explicitly marked refinement-needed cannot be implemented by guesswork. Consumer mocks must exercise real error envelopes, stale quotes, ambiguous outcomes, verified-but-unfinalized sale and schema rejection. Live pricing corpus is separate from synthetic contract fixtures.
