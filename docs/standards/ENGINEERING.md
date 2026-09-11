# Engineering standard

Provider-neutral core and one canonical truth. Functions/use cases have narrow responsibilities; no SDK leakage into features. Strict typed boundaries and explicit error states. Avoid new dependencies until lead reviews maintained status/security/size and need. Keep capabilities, configuration, entitlement, authorization and flags distinct. Log correlation/transaction/operation IDs with redacted context. Bounded timeouts/retries and health/attention surfaces are required. Merged scope stays small; audit first, remediation second. Evidence belongs to the commit/environment tested.

Owner: WS3. Controlling contracts/ADRs outrank generic examples. Done = evidence.
