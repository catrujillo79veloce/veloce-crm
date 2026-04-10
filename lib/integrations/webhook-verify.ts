import { createHmac, timingSafeEqual } from "crypto"

/**
 * Verify Meta webhook signature (x-hub-signature-256 header).
 *
 * Meta signs every webhook POST payload with HMAC-SHA256 using the
 * App Secret as key. The signature arrives as "sha256=<hex>".
 *
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  appSecret: string
): boolean {
  if (!payload || !signature || !appSecret) {
    return false
  }

  const expectedPrefix = "sha256="
  if (!signature.startsWith(expectedPrefix)) {
    return false
  }

  const signatureHash = signature.slice(expectedPrefix.length)

  const hmac = createHmac("sha256", appSecret)
  hmac.update(payload, "utf8")
  const expectedHash = hmac.digest("hex")

  // Timing-safe comparison to prevent side-channel attacks
  try {
    const sigBuffer = Buffer.from(signatureHash, "hex")
    const expectedBuffer = Buffer.from(expectedHash, "hex")

    if (sigBuffer.length !== expectedBuffer.length) {
      return false
    }

    return timingSafeEqual(sigBuffer, expectedBuffer)
  } catch {
    return false
  }
}
