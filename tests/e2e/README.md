# CORE-06 E2E pointer

Playwright remains the repository E2E runner:

```text
pnpm --dir apps/pos-web test:e2e
```

Combined cash-sale coverage lives at `apps/pos-web/e2e/cash-sale.spec.ts`. It exercises Sell UI → mocked BFF quote/prepare/cash/finalize/receipt routes. Isolated staging Woo writes are not executed here.
