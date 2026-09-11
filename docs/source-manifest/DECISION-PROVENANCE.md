# Decision provenance

| Decision | Evidence | Reconciliation |
| --- | --- | --- |
| One repo / Next BFF transition | S0 sections 7,31,56; S1 beginning and 44520–44560 | Explicit current instruction; broad ecosystem NestJS/Turborepo guidance does not expand P0 |
| WoodMart + B2BKing | S1 user correction at line 5353; S2 frontend ledger | Both participate; precedence is actual runtime, never guessed |
| No P0 InventoryPort | Older S4 suggestion; S1 44606–44609; S2 omits it; S0 section 14 | Current architecture resolution: quote/prepare retain availability responsibility |
| Payment finalization | S2 lacks commercial finalizer; S1 44599–44602 and 44640–44705 | Explicit SalesPort.confirmPayment server orchestration closes gap |
| Separate PrintPort | S1 44603–44605; S2 nextjs-handoff versus frontend-contracts discrepancy | ReceiptPort reads immutable data; PrintPort owns effects |
| Wire schemas | S1 44596–44612; S0 section 14–15 | Canonical v1 JSON Schema + OpenAPI + generated TypeScript |
| Safe offline / update | S2 ledger and cursor-handoff; S0 sections 12,31,33 | No offline launch settlement; preserve business state |
| Three owners / main model | S1 44710–44735,44960–44979; S0 sections 16,24–25 | Current Developer 1/2/senior naming controls; no staging branch mandated |
| Cutover gates | S1 45010–45040; S0 36–38 | No guessed parity, no destructive rollout; statutory process remains UNVERIFIED |
| Transfer Kit hierarchy | S3 README contains duplicated priority variants; S0 section 6 | Repository-specific hierarchy wins; no second generic kit |

New v1 wire details (decimal quantity, scoped idempotency, explicit errors and opaque sale identifiers) are implementation decisions made under S0's contract-freeze authorization, not claimed historical quotations. Live acceptance remains unverified.
