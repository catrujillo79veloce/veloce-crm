import { createHmac, timingSafeEqual } from "crypto"

/**
 * Compute the expected HMAC for a payload — useful for debugging
 * webhook signature mismatches without exposing the secret in logs.
 */
export function computeExpectedSignature(payload: string, appSecret: string): string {
  const hmac = createHmac("sha256", appSecret)
  hmac.update(payload, "utf8")
  return `sha256=${hmac.digest("hex")}`
}

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

/**
 * Verify the webhook signature against several candidate app secrets, passing
 * if ANY of them matches. Used by the Instagram handler: the same Meta app
 * owns the FB + IG products, so the real app secret is one value, but it may
 * live under either INSTAGRAM_APP_SECRET or FACEBOOK_APP_SECRET (the former was
 * historically misconfigured). Trying both lets us enforce signatures without
 * risking rejection of legitimate traffic over an env-var mixup. Empty/missing
 * secrets are ignored; returns false if none of the configured secrets match.
 */
export function verifyWebhookSignatureAny(
  payload: string,
  signature: string,
  appSecrets: (string | undefined)[]
): boolean {
  return appSecrets.some(
    (secret) => !!secret && verifyWebhookSignature(payload, signature, secret)
  )
}
