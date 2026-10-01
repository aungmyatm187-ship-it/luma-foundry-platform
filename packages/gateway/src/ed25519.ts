/**
 * Ed25519 verification.
 *
 * Discord signs every interaction with the application's Ed25519 key. Node's
 * `crypto` can verify Ed25519, but a raw 32-byte public key and a raw 64-byte
 * signature need wrapping into DER before `crypto.verify` will accept them.
 * That wrapping is the whole of this file.
 */
import { createPublicKey, verify as cryptoVerify } from 'node:crypto';

/** Wrap a raw 32-byte Ed25519 public key in the SPKI DER structure. */
function spkiFromRaw(rawKey: Uint8Array): Buffer {
  const prefix = Buffer.from('302a300506032b6570032100', 'hex');
  return Buffer.concat([prefix, Buffer.from(rawKey)]);
}

/**
 * Verify an Ed25519 signature over `message`.
 *
 * Returns false rather than throwing on malformed input: this is called on a
 * public endpoint, where bad input is routine.
 */
export function verifyEd25519(
  message: Uint8Array,
  signature: Uint8Array,
  rawPublicKey: Uint8Array,
): boolean {
  if (rawPublicKey.length !== 32 || signature.length !== 64) return false;
  try {
    const key = createPublicKey({ key: spkiFromRaw(rawPublicKey), format: 'der', type: 'spki' });
    return cryptoVerify(null, Buffer.from(message), key, Buffer.from(signature));
  } catch {
    return false;
  }
}
