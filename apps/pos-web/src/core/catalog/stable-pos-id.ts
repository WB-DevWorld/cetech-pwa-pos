import { createHash } from "node:crypto";

/**
 * CETECH POS catalog namespace (UUID). Source Woo ids are inputs only;
 * domain posItemId values are opaque UUID v5 identifiers derived from
 * `sourceSystem:sourceItemId`.
 */
export const CATALOG_POS_ITEM_NAMESPACE = "8c2e9b10-7f3a-51d4-9c6e-a1b2c3d4e5f6";

export function stableCatalogPosItemId(sourceSystem: string, sourceItemId: string): string {
  return uuidV5(`${sourceSystem}:${sourceItemId}`, CATALOG_POS_ITEM_NAMESPACE);
}

function uuidToBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ""), "hex");
}

function uuidV5(name: string, namespace: string): string {
  const hash = createHash("sha1");
  hash.update(uuidToBytes(namespace));
  hash.update(name, "utf8");
  const bytes = Buffer.from(hash.digest());
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
