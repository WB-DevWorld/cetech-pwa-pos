# Demo Scenarios

Use the separate **Demo controls** button to trigger operational edge states. Demo controls are intentionally not part of the cashier navigation.

## A — Walk-in retail

1. Sign in as Ama Mensah.
2. Open Front Counter 1 with an opening float.
3. On Sell, use the Hardener demo barcode or scan/type `0012345678901` + Enter outside an input.
4. Wait for **Price confirmed**.
5. Press **Pay** → **Cash** → choose Exact or enter an amount.
6. Confirm cash and view the receipt.

## B — Quantity price

1. Add the hardener or Premium Interior Emulsion Paint.
2. Enter a larger quantity directly.
3. Observe **Updating price…** then **Quantity pricing applied**.

## C — Wholesale

1. Add a product.
2. Select the customer from the cart.
3. Choose **Accra Buildworks Ltd** or another fictional wholesale company.
4. Observe the visible **WHOLESALE** context and authoritative mock requote.

## D — Price changed

1. Keep a confirmed cart.
2. Open Demo controls.
3. Choose **Next quote: price changed**.
4. The new quote discloses the changed price rather than silently replacing it.

## E — Stock changed

1. Keep a confirmed cart.
2. Open Demo controls → **Next Pay: stock changed**.
3. Press Pay.
4. Payment is not started; the cart is returned for quantity repair/requote.

## F — MoMo pending

1. Pay → **Mobile Money**.
2. On the hosted-payment simulation choose **Pending**.
3. Observe **Do not charge again**.
4. Choose **Check again — resolve success**.

## G — Offline

1. With an active cart, open Demo controls → **Go offline**.
2. Product browsing/search and cart editing remain available.
3. Pay is disabled with a connection-required reason.
4. Go online; the cart requotes before Pay returns.

## H — Return

1. Open **Returns**.
2. Choose an eligible order.
3. Select quantity, reason and condition.
4. Preview refund, approve, and observe completion.
5. Use Demo controls before approval to make the next refund **Pending** or **Needs attention**.

## I — Register close

1. Register → Close register.
2. Enter the blind cash count.
3. Review expected vs counted cash and variance.
4. A large variance requires the fictional manager approval.
5. Close and view the immutable preview Z report.

## J — PWA update

1. With an active cart, choose **Simulate Update Ready**.
2. Update is deferred.
3. During an active payment, the same state is blocked-critical.
4. At a safe point the update can be applied without deleting business state.

## K — Transaction recovery

1. With a confirmed cart, Demo controls → **Next Pay: response loss**.
2. Press Pay.
3. The UI moves from Preparing to Checking sale status.
4. It recovers the already-prepared mock order rather than creating another.

## Other useful states

- **Unknown barcode** button → product not found.
- **Collision demo** → duplicate barcode match.
- **Slow next quote** → change quantity while a slow quote is in flight; the stale response is ignored.
- **Expire current quote** → Pay is blocked by expiry.
- **Next print: fail** → receipt remains saved and can be reprinted.
- **Next refund: pending / needs attention** → refund reconciliation states.
- **Catalog fresh/stale**, **Local DB healthy/warning**, **Version supported/unsupported** → Store Health states.
- **Data migration** → local migration and another-tab blocker.
- **Passive second tab** → local register leadership protection concept.
- **Fix App** → non-destructive recovery path before destructive reset.
