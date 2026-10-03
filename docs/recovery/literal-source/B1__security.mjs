import crypto from "node:crypto";

/**
 * Lemon Squeezy signs the raw webhook request with HMAC-SHA256. Verify the
 * raw Buffer, never a JSON-stringified reconstruction of the parsed object.
 */
export function verifyLemonSignature({ rawBody, signature, signingSecret }) {
  if (!Buffer.isBuffer(rawBody) || !signature || !signingSecret) return false;

  const expected = crypto
    .createHmac("sha256", signingSecret)
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(String(signature), "utf8");

  return (
    expectedBuffer.length === actualBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

export function createLemonSignature(rawBody, signingSecret) {
  return crypto.createHmac("sha256", signingSecret).update(rawBody).digest("hex");
}
