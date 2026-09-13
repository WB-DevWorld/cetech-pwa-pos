# Redacted R3 pricing corpus

No customer names, emails, phones, addresses, passwords, Application Passwords, cookies, or service credentials.

Each case records case ID, environment, UTC, plugin/theme versions, customer-context class, product/variation surrogate, quantity, currency, authoritative expected **unit price and** line/cart totals, applicability, and result.

`unitPriceMinor` is the display-rounded authoritative per-unit price. It is asserted independently of line/cart totals. Do not derive line total as `unitPrice × quantity`. Line identity remains `total = subtotal - discount + tax`.

Synthetic isolation rows prove the bridge matches an injected Woo runtime. They are not WoodMart/B2BKing live parity.

Live training rows use `LIVE_TRAINING_CAPTURE` or `NOT_APPLICABLE_WITH_EVIDENCE`. Training tax-off remains `NOT_APPLICABLE_WITH_EVIDENCE` from CP-04. `pricingParityVerified` stays false until the R3 gate is actually satisfied.
