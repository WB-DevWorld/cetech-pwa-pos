# Offline Sync standard

Launch offline: cached catalog/search/barcode/cart drafts. Quote/final checkout/electronic settlement/refunds/authoritative close require connection. Cached price/stock are advisory, never a network reservation. Dexie journal appends before side effect and stores versioned payload/key/hash; unknown outcomes resolve before replay. Retry same intent/key with bounded backoff; no automatic new tender. Projection sync uses source watermark/version, tombstones, webhook dedupe plus periodic/manual reconciliation. A missed webhook must not permanently drift catalog. Catalog rebuild cannot erase drafts/journal; replay authorization rechecked server-side. Device persistence failure blocks critical send rather than issuing unjournaled requests.

Owner: WS3. Controlling contracts/ADRs outrank generic examples. Done = evidence.
