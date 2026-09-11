# Current controlling architecture

Status: CURRENT design baseline, TRANSITIONAL providers; runtime implementation absent at bootstrap.

CETECH PWA → Next.js/React/TypeScript features → application use cases → provider-neutral ports → Next.js BFF/server → Supabase POS operations, Woo REST reads, payment provider and CETECH POS Bridge → Woo runtime + WoodMart + B2BKing.

Local Dexie adapters serve cached catalog/barcode search and durable cart/journal. UI changes increment cart revision and invalidate quote; old responses cannot overwrite newer carts. Supabase projections include source IDs, version/freshness timestamps, tombstones and sync watermarks. Cached availability is advisory.

The BFF verifies staff session, organization/location/register access, schema, CSRF/origin as applicable, rate limits and idempotency. It resolves actual customer commercial context server-side. No browser-submitted B2B group, price or actor grants authority. Woo bridge executes whole-cart commercial evaluation in isolated request context, then restores any global runtime context.

Quote is not a stock reservation. Prepare revalidates accepted quote fingerprint, quantities, customer/tax/stock, creates at most one Woo order per POS transaction and proves the selected Woo stock behavior. Do not label an order 'reserved' before runtime reservation/reduction is verified. Payment occurs only against that order/amount. FinalizeSale use case loads verified tender, invokes SalesPort.confirmPayment idempotently, then records POS completion and immutable receipt. Cross-database effects use durable workflow/outbox and reconciliation, never a fictional distributed transaction.

Critical unknowns: plugin/runtime versions, VitePOS stock mode, barcode mapping, tax process, provider account and hardware. See LIVE-ENVIRONMENT-FACTS.md. Pricing parity and concurrent last-unit stock proof gate real checkout. No current deployment is implied by this document.
