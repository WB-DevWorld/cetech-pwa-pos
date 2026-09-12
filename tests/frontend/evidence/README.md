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
