# Prototype → production contract mapping

| Prototype handoff | Frozen production correction | Reason |
| --- | --- | --- |
| Money minor:number | Money safe nonnegative integer; SignedMoney for deltas | Exact minor-unit arithmetic and explicit variance |
| quantity:number | Quantity canonical positive decimal string | Avoid fractional arithmetic drift; preserve configured product units |
| CustomerContext embeds summary | Discriminated kind + customerId; resolved server-side | Minimize PII and prevent client-owned commercial group |
| CommerceQuote | Quote with cart/location binding and server snapshot ID | Stable accepted quote and revalidation |
| PreparedSale.providerOrderId, status reserved | Opaque saleId, status prepared, stockCommitment verified | Avoid provider leakage and unproven reservation claim |
| SalesPort prepare/resolve/cancel | Add server-only confirmPayment; BFF FinalizeSale orchestrates | Explicit payment → commercial boundary |
| PaymentState finalizing/completed mixed into tender | Tender verified; SaleResolution finalizing/completed separate | Payment and sale are separate state machines |
| ReceiptPort.reprint | ReceiptPort read + PrintPort.print | Immutable receipt versus device effect |
| Historical InventoryPort | No P0 standalone port | Availability stays quote/prepare responsibility |
| Optional mutation key / sparse journal | Required scoped mutation keys + payload/hash/version journal | Safe recovery and replay |
| recordCashMovement accepts actor/amount | Server derives actor and signed ledger effect | Client cannot forge operator or accounting direction |
| Supabase demo auth | IdentityPort + server-validated session/permissions | No fictional staff credentials in production |

These changes preserve the approved UX; they are not permission to redesign the source artifact. Production app imports/reexports generated declarations without copying competing definitions.
