# FE-02 visual evidence

Isolated Playwright/Vitest harness for the FE-02 shell, login gate, and open-register form.

These screenshots are **not** pixel-perfect matches of the immutable approved Sell/cart captures:

- `reference/frontend-approved/artifact/verification-sell-desktop.png`
- `reference/frontend-approved/artifact/verification-mobile-cart.png`
- `reference/frontend-approved/artifact/verification-desktop.png`

FE-02 does not implement Sell catalog, cart, barcode, or checkout. The harness injects FE-02 CSS and components only, without mounting `src/app` routes.

## What FE-02 compares from the approved captures

From those reference screenshots, FE-02 preserves and evidences:

- navigation rail placement and hierarchy
- top-bar structure/status presentation
- desktop/tablet rail behavior
- phone bottom-navigation transformation
- approved breakpoints
- approved semantic tokens
- focus-visible treatment
- minimum touch targets
- reduced-motion treatment
- login/open-register visual language where applicable

FE-02 does **not** prove:

- Sell product-grid parity
- cart contents/layout parity
- checkout/tender parity
- barcode/customer behavior
- integrated App Router parity
- live runtime parity

Those remain later-task or WS3 integration evidence. FE-02 does not implement Sell/cart to manufacture that parity.

## Isolated vs integrated evidence

These screenshots prove the **FE-02 component and CSS layer in isolation**. They do **not** prove integrated App Router / layout appearance.

Current `main` still ships the CP-05 engineering scaffold stylesheet at `apps/pos-web/src/app/globals.css`. That file includes temporary scaffold-only global rules such as:

- `body { padding: 2rem; }`
- `main { max-width: 42rem; }`
- global `h1` sizing/margin
- global `p` margin

Those rules were **not** loaded by this harness. Importing FE-02 CSS into the existing CP-05 `layout.tsx` is **not** sufficient while those scaffold-only globals remain; they would override or distort the approved POS shell (padding, constrained main, heading/paragraph spacing).

When WS3 performs route mounting, WS3 must first retire or replace those CP-05 scaffold-only global rules, then wire FE-02 styles and components. FE-02 must not edit `apps/pos-web/src/app/globals.css` because `src/app/**` remains WS3-owned.

Integrated route-level visual evidence must be obtained by WS3 after that mount. FE-02 does not claim integrated route parity.

Viewport classes used:

| File | Viewport | Expected shell behavior |
| --- | --- | --- |
| `shell-desktop.png` | 1440×900 | Persistent left rail, Settings in sidebar bottom, cashier pill visible |
| `shell-tablet.png` | 900×800 | Rail retained, secondary cashier pill hidden |
| `shell-phone.png` | 390×844 | Bottom navigation, Settings/brand hidden |
| `login-desktop.png` | 1440×900 | Production Sign in, no fictional staff |
| `register-desktop.png` | 1440×900 | Opening-float money input, adapter register list |

## FE-03 isolated Sell evidence

FE-03 adds isolated Sell workspace HTML/screenshots generated the same way: Vitest writes static markup, Playwright `setContent`s it. These are **not** integrated App Router captures and **not** pixel-perfect matches of `verification-sell-desktop.png` / `verification-mobile-cart.png`.

Comparison scope for FE-03:

- two-pane desktop/tablet Sell layout (products left, cart right)
- phone cart overlay / Back control
- variation chooser dialog copy
- unknown-barcode alert
- customer display name plus optional server-supplied Wholesale context
- stale/offline catalog banners in cashier language
- Pay remains visible and disabled
- no demo barcode chips

Cashier-facing copy in the Sell UI is operator language. Preparation/runtime-gate limitations live in this README, not in the rendered workspace.

FE-03 does **not** prove:

- live CatalogPort / CustomerPort / CartDraftStore behavior
- Dexie draft persistence
- barcode mapping from a real catalog projection
- quote/pricing/checkout (FE-04)
- pixel parity with the approved Sell/cart PNGs
- integrated `src/app` route appearance
- interactive modal focus trapping (the visual harness is static HTML without React event handlers)

The presentation components and pure cart/barcode rules are reusable. CORE-04 integration still needs a port-backed controller/orchestration pass for asynchronous catalog/customer search and durable CartDraftStore IO.

| File | Viewport | Expected Sell presentation |
| --- | --- | --- |
| `sell-desktop.png` | 1440×900 | Product pane left, cart right, Pay disabled |
| `sell-tablet.png` | 900×800 | Split survives; narrower cart |
| `sell-phone.png` | 390×844 | Full-screen cart overlay |
| `sell-variation.png` | 1440×900 | Choose-variation dialog |
| `sell-unknown-barcode.png` | 1440×900 | Unknown barcode alert |
| `sell-customer.png` | 1440×900 | Selected b2b customer + Wholesale display |
| `sell-offline.png` | 1440×900 | Offline cached catalog + saved draft banners |
