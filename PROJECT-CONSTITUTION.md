# CETECH PWA POS constitution

Objective: a safe production-usable transition within 60 elapsed development hours. The clock and staffing schedule must be recorded at kickoff. Correctness outranks feature count; the deadline cannot waive pricing, money, authorization, recovery or release gates.

- One canonical owner per truth. WooCommerce is transitional commerce authority, not the long-term identity of the POS.
- WoodMart participates in current configured retail quantity/tier pricing. B2BKing participates in configured B2B/wholesale terms. Their combined authoritative pricing executes server-side in Woo runtime. Browser components never reconstruct it.
- Supabase owns legitimate registers, devices, shifts, cash movements, workflow, audit and configuration; projections are rebuildable and explicitly stale. No duplicate catalog/pricing/order/stock master.
- IndexedDB/Dexie contains local projections, barcode indexes, drafts and a durable operation journal, not enterprise truth.
- UI/application contracts are provider-neutral. Replace adapters, not cashier workflows.
- Next.js BFF is the immediate server boundary. No mandatory NestJS, Medusa, Vendure, microservices, RabbitMQ, Kubernetes or Turborepo setup in this cut.
- Authoritative pricing, payment verification and privileged credentials stay server-side. Client role/group/price/actor assertions are untrusted.
- Critical operations require durable idempotency, explicit ambiguous outcomes, reconciliation and audit. Payment success and commercial finalization are different states.
- PWA updates/recovery preserve unsynced work and activate at safe points. Launch offline scope is browsing/search/barcode/drafts; settlement/refunds/shift close require connectivity.
- The approved reference is immutable. Production changes preserve layout, language and interaction semantics unless explicitly approved.
- Architectural changes require decision documentation. Done = evidence; no completion claim without applicable tests/runtime proof.
- Future independent POS peer migration remains visible. Optional capabilities/configuration/authorization/entitlements/flags are distinct; do not build a generic plugin framework now.
- Production promotion requires human approval; live money, stock, invoice and VitePOS cutover gates cannot be inferred from demo screenshots.
