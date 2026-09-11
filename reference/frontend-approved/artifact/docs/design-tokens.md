# CETECH POS — Design Tokens

The CSS custom properties in `styles.css` are the source of truth for this preview and should be migrated into the Next.js design-token layer with the same semantic names where practical.

## Color semantics

| Token | Role |
|---|---|
| `--color-bg` | application canvas |
| `--color-surface` | primary operational surfaces |
| `--color-surface-2` | secondary/selected/neutral emphasis |
| `--color-surface-3` | stronger neutral separation/skeleton |
| `--color-text` | primary text |
| `--color-text-muted` | supporting text |
| `--color-border` | surface/control boundaries |
| `--color-primary` | primary action / configured CETECH accent |
| `--color-primary-hover` | primary hover |
| `--color-primary-soft` | selected/wholesale/informational emphasis |
| `--color-success` / `--color-success-soft` | confirmed/healthy/complete |
| `--color-warning` / `--color-warning-soft` | pending/stale/attention |
| `--color-danger` / `--color-danger-soft` | blocked/error/critical |
| `--color-info` / `--color-info-soft` | informational/system status |

No final CETECH brand palette was provided. Replace only the semantic values, not component-specific random colors.

## Spacing

4px base scale: `--space-1` 4, `--space-2` 8, `--space-3` 12, `--space-4` 16, `--space-5` 20, `--space-6` 24, `--space-8` 32.

## Radius & elevation

- Small: 8px
- Medium operational surface: 12px
- Large sheet/dialog: 18px
- Elevation: `--shadow-sm`, `--shadow-md`

## Typography

System UI stack is intentional for a zero-install operational app. Scale:

- XS 12px — technical/supporting labels
- SM 14px — dense operational metadata
- MD 16px — default body/control text
- LG 20px — section emphasis
- XL 26px — page heading
- 2XL 34px — large payment/change totals

Weights 700–900 are used sparingly for cashier-scannable amounts and primary labels.

## Touch and controls

- Minimum interaction target: `--touch: 44px`.
- Primary Pay control: 54px minimum height.
- Quantity +/- controls remain touchable while staying space-efficient.
- Disabled state uses both opacity and contextual blocking copy.

## Focus

All interactive controls use a 3px semantic primary focus ring with 2px offset. Keyboard access is a first-class desktop POS path.

## Motion

- No decorative transaction animation.
- Toast entrance and skeleton shimmer are the only notable motion.
- `prefers-reduced-motion: reduce` effectively removes animation/transition duration.

## Breakpoints

- `>1050px`: desktop / large POS terminal.
- `821–1050px`: tablet / compact desktop split view.
- `≤820px`: phone-oriented flow, bottom navigation, cart full-screen.
- `≤480px`: single-column product/tender layout.

These breakpoints are behavioral, not merely scale changes.

## Print

`@media print` hides application chrome and prints `.receipt-paper`. Receipt width is 80mm with browser/A4 fallback. Production can preserve this markup/CSS while adding printer adapters later.
