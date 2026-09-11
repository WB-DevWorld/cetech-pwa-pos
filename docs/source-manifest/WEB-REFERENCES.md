# Technical references checked 2026-09-11

- [GitHub branch protection availability](https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches): private protection depends on plan; corroborates observed API restriction.
- [GitHub CODEOWNERS](https://docs.github.com/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners): review routing/enforcement distinction and write-access requirements.
- [Cursor rules](https://cursor.com/docs/rules): .mdc metadata description/globs/alwaysApply and scoped activation.
- [Woo HPOS recipe book](https://developer.woocommerce.com/docs/features/orders/high-performance-order-storage/recipe-book/): use Woo APIs/CRUD for order compatibility.
- [WoodMart dynamic discounts](https://xtemos.com/docs-topic/dynamic-discounts/): configured quantity discounts; actual installed overlap still requires parity tests.
- [B2BKing tiered pricing](https://woocommerce-b2b-plugin.com/docs/b2bking-tiered-pricing-setup-auto-generated-tiered-pricing-table/): tiered product pricing capabilities; not proof of CETECH configuration.
- [B2BKing customer prices](https://woocommerce-b2b-plugin.com/docs/customer-price-lists/): customer-specific pricing support; current installation applicability UNVERIFIED.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): grants and policies, elevated-key bypass, negative testing.

External docs support implementation guidance, not live CETECH facts. Revalidate exact package/runtime/plugin APIs when implementing and pin compatible versions through CP-05/BR-01.
