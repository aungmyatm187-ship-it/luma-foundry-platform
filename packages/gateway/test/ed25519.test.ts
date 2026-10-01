/**
 * Ed25519 verifier tests.
 *
 * This verifier is the only thing standing between a public endpoint and a
 * forged request, so it is tested against real signatures rather than a stub:
 * a valid signature must pass, a tampered message must fail, and a signature
 * from a different key must fail.
 */
import { describe, expect, it } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import { verifyEd25519 } from '../src/ed25519.js';

/** Extract the raw 32-byte Ed25519 public key from a generated key pair. */
function rawPublicKey(): { raw: Uint8Array; sign: (msg: Uint8Array) => Uint8Array } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const der = publicKey.export({ format: 'der', type: 'spki' });
  // SPKI for Ed25519 ends with the 32-byte key after a 12-byte prefix.
  const raw = new Uint8Array(der.subarray(der.length - 32));
  return { raw, sign: (msg) => new Uint8Array(sign(null, Buffer.from(msg), privateKey)) };
}

describe('verifyEd25519', () => {
  it('accepts a real signature over the message', () => {
    const { raw, sign: doSign } = rawPublicKey();
    const message = new TextEncoder().encode('1234567890{"type":1}');
    expect(verifyEd25519(message, doSign(message), raw)).toBe(true);
  });

  it('rejects a tampered message', () => {
    const { raw, sign: doSign } = rawPublicKey();
    const message = new TextEncoder().encode('{"type":1}');
    const signature = doSign(message);
    const tampered = new TextEncoder().encode('{"type":2}');
    expect(verifyEd25519(tampered, signature, raw)).toBe(false);
  });

  it('rejects a signature from a different key', () => {
    const a = rawPublicKey();
    const b = rawPublicKey();
    const message = new TextEncoder().encode('payload');
    expect(verifyEd25519(message, b.sign(message), a.raw)).toBe(false);
  });

  it('rejects a wrong-length public key without throwing', () => {
    const { sign: doSign } = rawPublicKey();
    const message = new TextEncoder().encode('payload');
    expect(verifyEd25519(message, doSign(message), new Uint8Array(31))).toBe(false);
  });

  it('rejects a wrong-length signature without throwing', () => {
    const { raw } = rawPublicKey();
    expect(verifyEd25519(new TextEncoder().encode('x'), new Uint8Array(63), raw)).toBe(false);
  });

  it('rejects garbage without throwing', () => {
    const { raw } = rawPublicKey();
    expect(() => verifyEd25519(new TextEncoder().encode('x'), new Uint8Array(64), raw)).not.toThrow();
  });
});
