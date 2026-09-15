import { createHmac, timingSafeEqual } from "node:crypto";

export function hmacSha512Hex(secret: string, rawBody: string): string {
  return createHmac("sha512", secret).update(rawBody, "utf8").digest("hex");
}

/** Constant-time compare of UTF-8 hex signatures. Length mismatch is a miss, not an exception. */
export function signaturesMatch(expectedHex: string, provided: string | null): boolean {
  if (!provided) {
    return false;
  }
  const expected = Buffer.from(expectedHex, "utf8");
  const actual = Buffer.from(provided, "utf8");
  if (expected.length !== actual.length) {
    return false;
  }
  return timingSafeEqual(expected, actual);
}

export function paystackSignatureValid(rawBody: string, signature: string | null, secret: string): boolean {
  return signaturesMatch(hmacSha512Hex(secret, rawBody), signature);
}
