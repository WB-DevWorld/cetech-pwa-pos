# Transitional provider arrangement

Status: TRANSITIONAL. Next BFF is the initial server; Supabase Auth behind IdentityPort is the temporary staff identity mechanism, with POS permissions checked server-side. Woo customers are buyers, not staff authorization identities.

Woo REST may feed catalog/customer/order read adapters. Protected current-customer/cart pricing, stock preparation, cancellation and commercial refunds belong in the bridge runtime boundary. Do not assume REST product price fields reproduce plugin cart behavior.

Supabase owns operations and rebuildable source projections. Keep provider mappings in server adapters/storage only. Retain external order/payment IDs for audit and historical lookup, without exposing provider internals to UI domain logic. Projection/outbox failure after a Woo commit yields reconciliation, not a second sale.

MVP active capabilities: sale, catalog, customers, register, cash, receipt and recovery. Electronic tender and returns follow explicit live gates. Full offline settlement, split tender, multi-stock orchestration and direct thermal protocols are deferred unless separately approved. Browser print fallback must be tested on actual hardware. Do not install more infrastructure merely to resemble the target.
