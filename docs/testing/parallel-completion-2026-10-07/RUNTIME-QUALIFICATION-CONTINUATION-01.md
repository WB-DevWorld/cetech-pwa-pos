# Runtime qualification continuation — PR #144

Status: **ACTIVE RUNTIME QUALIFICATION** (source ACCEPTED; RD-01 COMPLETE)  
Acting implementer: `@wbdevworld` / WS3  
Bridge domain reviewer: `@Emmanuel-coder-prog` / WS2 (distinct; unrecorded)  
Staff-documentation impact: **NONE**  
Production effects: **NONE**  
Verdict: **NOT READY FOR PRODUCTION**

## Frozen qualification artifact

| Pin | Value |
| --- | --- |
| Reviewed docs tip (freeze) | `f0feb44e9b3b241f0f712d3e306a9b768e0a070a` |
| Product tip | `ab5c7e1f3849ff65100a84058e92f8b281a14be2` |
| Bridge tree (product ≡ freeze ≡ later docs tips) | `fc8f2d05e7fe36001c3e9265cad0b4754417fedd` |
| Fixed Preview deployment | `dpl_8pUT6fhYPKxR6B7uFhoUVUx2ZYJL` **READY** — Git head `f0feb44…` |
| Fixed Preview URL | https://cetech-pos-staging-d299u3ex7-wbdevworlds-projects.vercel.app |
| Product Preview (optional) | `dpl_CBSAUNVvXLmuXetnwC3z8DLeAdm2` — https://cetech-pos-staging-acs2cuq3m-wbdevworlds-projects.vercel.app |
| Shared tester (unchanged) | `dpl_nxWGrSLqaLBGNNN683QjdixNBjF6` / `BUILD_ID` `816e0bb…` |
| Do not use | Old `pji89co71` URL with `dpl_CBSA` (that URL belonged to `5ea92dc`) |

Documentation-only tips after `f0feb44` (including RD-01 receipt `5cc2d5f…`) do **not** restart runtime qualification. Prove product-tree equivalence via bridge tree `fc8f2d05…`.

## Lane 1 — candidate browser / PWA / hardware

Probe window: `2026-10-08` (agent desktop Chromium + HTTP).

| Check | Result |
| --- | --- |
| Preview HTTP `/` | **200** — CETECH POS staff sign-in renders |
| SW controller | `/sw.js?build=local-dev` |
| `GET /api/pos/v1/release-policy` (+ UUID `X-Correlation-ID`) | **200** `cache-control: no-store` — `latest/recommended/minimumSupportedBuild` = **`local-dev`** (same on product Preview `dpl_CBSA…`) |
| Shared tester release-policy | `816e0bb6963aff760609a3c7e4817e603c4ffdf0` (contrast) |
| `GET /api/pos/v1/health` | **401** `AUTH_REQUIRED` — staff session required |
| Staff session | **BLOCKED** — sign-in surface shows “Access denied… permission to sign in here” with reference ids (e.g. `795c3a98-…`); no credentials collected; **operator local sign-in required** |
| Installed PWA / physical scanner / printer | **UNVERIFIED** — physical device absent in this agent session (concrete qualification gap, not approval gap) |
| Print/reprint existing safe receipt | **UNVERIFIED** — needs session + device/receipt |
| Startup / next-customer timing | Not claimed — checkout not run |

**Lane 1 next:** operator signs in on fixed Preview `dpl_8pUT…`, records observed `BUILD_ID`/bindings, then continues installed-PWA + local cart/reload + printer steps.

## Lane 2 — bridge artifact + commercial scope (RD-02 package)

| Item | Value |
| --- | --- |
| Candidate artifact | product tip `ab5c7e1` / tree `fc8f2d05…` |
| Local package | `bridge-artifact-ab5c7e1/cetech-pos-bridge-ab5c7e1-fc8f2d05.zip` |
| Zip SHA-256 | `e875ec3af476e230f2571624a3d0111dc29c1856d1793481deecfc1b6dbfa503` |
| File manifest | `bridge-artifact-manifest-ab5c7e1.json` (41 files) |
| Main plugin SHA-256 | `63094753eb380b57c1e7e6db1a172ead3a295112e538d6722ffb4325f7ff58ab` |
| `class-woo-runtime.php` SHA-256 | `89e4461c3ff7e7ef2dc6ff525751f799f4b92604d655880e9840256128deb76c` |
| Identity proof in artifact | `assert_prepared_order_operation_identity` **present** |
| Installed training baseline | `0.6.0-stg05` — main `9fee0c40…` / runtime `39159cb3…` — **lacks** identity proof (global order-count) — **VERIFIED** `2026-10-08T14:14Z` |
| Version header in package | still `0.6.0-stg05` label — **not** loaded-generation proof; prove via file hashes + identity method after install |
| Install | **NOT authorized** by source acceptance — see `RD-02-EXECUTION-REQUEST.md` |

Tracks A+D share one sale identity. Track B = Paystack TEST only. Track C needs stock=1 fixture (49111@4 insufficient). Org/location/register/shift ids still need staff session.

## Lane 3 — backup / recovery

| Item | State |
| --- | --- |
| Bridge tarball identity | `/home/cetechtraining/backups/cetech-pos-bridge-0.6.0-stg05-before-d0480d33-20260924T074530Z.tgz` (+ older) — listing **VERIFIED** `2026-10-08T14:12Z`; proves plugin rollback only |
| Full WP/Woo/DB + POS backup | **UNVERIFIED** as complete restore set in this continuation |
| Isolated disposable restore | **UNEXECUTED** — needs named non-shared target |
| Shared/paid/remote restore or tester alias | **RD-03** — not requested yet; alias stays on `dpl_nxWG…` / `816e0bb…` |

## Closed (do not redo)

- Root technical source acceptance for bounded #144 corrections (not Emmanuel approval; not production GO)
- RD-01 staging `#143` → hosted `20261008151307` (`RD-01-STAGING-EXECUTION-RECEIPT.md`)

## Remaining blockers

1. Operator staff sign-in on fixed Preview (Lane 1 continuation)
2. Exact-SHA `BUILD_ID` binding on Preview currently reports `local-dev` — treat as binding gap until operator/CI proves SHA build id
3. RD-02: training bridge install of `ab5c7e1`/`fc8f2d05` + bounded tracks
4. Track C stock=1 fixture (read-only search still needs training WP-CLI access)
5. Physical device / printer / installed PWA
6. Full backup identity + isolated restore rehearsal; RD-03 only if shared/paid/remote/alias

## Related

- `RD-02-EXECUTION-REQUEST.md`
- `QUALIFICATION-RD-DECISIONS.md`
- `RUNTIME-DECISIONS-MANIFEST.md`
- `RD-01-STAGING-EXECUTION-RECEIPT.md`
