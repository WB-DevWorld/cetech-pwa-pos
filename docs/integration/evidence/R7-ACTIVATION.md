# R7 activation — electronic payment and reconciliation

Date: 2026-09-15 UTC
Integration issue: #57 `[R7-00] Integrate verified electronic payment and reconciliation`
Implementation task: PAY-01 / #26
Neutral branch: `batch/r7-electronic-payment-reconciliation`
Integration editor: `@wbdevworld` / WS3
Activation baseline: `main` `bd79c2901ce33c3177141d4244cc196be0a719d2`
R6 post-merge CI: `34966689340` SUCCESS on Linux + Windows (`control-plane`, `control-plane-windows`)

## R6 closure

R6 PR #55 was squash-merged to `main` as `bd79c2901ce33c3177141d4244cc196be0a719d2`. Closed as completed: CORE-06 / #25, R6-00 / #54, CORE-HARDEN-07 / #56. Isolated training cash sale order `49439` remains historical evidence; this activation does not authorize a second training Woo order.

Issue #4 remains OPEN. `pricingParityVerified=false`. Production promotion is not authorized.

## R7 scope

R7 consists of **PAY-01 only**. Owner `@wbdevworld` / WS3. Milestone outcome: electronic payment and reconciliation.

Acceptance direction:

- server verification binds amount/currency/order
- duplicate/out-of-order callbacks are safe
- pending does not re-charge
- reconciliation recovers unknown outcomes
- authorized provider sandbox evidence when TEST credentials already exist

No FE-06. No returns/refunds. No R8. Frozen v1.0.0 contracts remain authoritative. `PaymentPort.initialize` / `resolve` and `VerifiedPaymentEvidence.verificationSource = provider_server_verification` already exist; R7 implements them. Refund remains R8.

## Provider boundary

No newer explicit provider decision exists in repository truth. Initial concrete sandbox provider: **Paystack test mode**. Canonical POS payment state remains provider-neutral. Provider-specific concepts stay behind an adapter (`ElectronicPaymentProvider` / `PaystackElectronicPaymentProvider` or equivalent). Fail closed on live-mode configuration. Never expose provider secrets to browser JS, HTML, client responses, logs, evidence Markdown, or committed env files.

Sandbox authorization is TEST-mode only, and only if credentials already exist through an approved local/staging secret mechanism. Absent credentials is not a prompt loop; code proceeds, then the sandbox gate is classified separately. Do not perform live card or mobile-money charges. Do not create another training Woo sale to exercise Paystack.

## Safety limits

- One contributor branch: `ws3/pay-01-implement-verified-electronic-payment-and-rec` from the published activation SHA, not from old R6 main.
- Neutral branch records activation/integration; PAY-01 source is implemented on the contributor branch and imported by cherry-pick.
- Do not open, request reviewers, approve, or merge the R7 PR from this assignment.
- Do not start R8.
- Do not merge anything.
- Production promotion: NOT AUTHORIZED.
- Live electronic payment: NOT AUTHORIZED.

## Initial state

- PAY-01: **AUTHORIZED / NOT STARTED** at activation
- Neutral branch initially equals `main` (`bd79c29…`) until this activation commit
- Milestone PR: **not opened**
- FE-06 / RT-01 / R8: **not authorized**
