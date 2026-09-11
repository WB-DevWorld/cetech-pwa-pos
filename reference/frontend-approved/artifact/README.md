# CETECH POS Frontend Preview

## Use it

1. Extract the folder/archive.
2. Double-click `index.html`.
3. Sign in with either fictional demo staff account.
4. Open a register with an opening float.
5. Use **Demo controls** to exercise pricing, stock, outage, payment, PWA update and recovery states.

No npm, Node.js, dev server, CDN or internet connection is required merely to render and use the preview.

## Important

- All products, customers, prices, orders, payments and provider behavior are fictional preview/demo data.
- The preview does not call WooCommerce, WoodMart, B2BKing, Supabase, Paystack or any production API.
- No production credentials are required or included.
- The ordinary receipt is explicitly an **operational preview receipt**, not a statutory Ghana VAT/E-VAT invoice.
- `frontend-contracts.ts` and the files under `docs/` are production handoff material for Cursor/AI coding agents.
- Production conversion replaces mock adapters and preview persistence with Next.js/TypeScript, Dexie/IndexedDB, CETECH POS Bridge, Supabase transitional POS operations and the approved real provider adapters while preserving the approved frontend design.

## Useful demo barcodes

- `0012345678901` — simple hardener product with quantity-price demo.
- `0001112223334` — exact red cable variation; leading zeroes matter.
- `9999999999999` — unknown barcode state.

A keyboard-wedge scanner can be tested by scanning/typing a barcode rapidly outside an input and sending Enter.
