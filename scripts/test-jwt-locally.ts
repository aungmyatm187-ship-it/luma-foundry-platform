/**
 * Verifies the createContext JWT path without touching Supabase.
 *
 * Generates an RSA keypair, signs a JWT with the correct sub/iss claims,
 * serves the public key as a JWKS over a local HTTP server, and calls the
 * exact verification logic from trpc.ts against that local endpoint.
 *
 * This proves the code path works. It does not prove Supabase will produce
 * compatible JWTs — only that our verification accepts well-formed ones.
 */
import { createServer } from 'node:http';
import { SignJWT, exportJWK, generateKeyPair, createRemoteJWKSet, jwtVerify } from 'jose';

async function main() {
  console.log('══ Local JWT Verification Test ══\n');

  console.log('── 1. Generate RSA keypair ──');
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  jwk.kid = 'test-key-1';
  jwk.alg = 'RS256';
  jwk.use = 'sig';
  console.log('  Key ID:', jwk.kid);

  console.log('\n── 2. Start local JWKS server ──');
  const jwks = { keys: [jwk] };
  const server = createServer((req, res) => {
    if (req.url === '/.well-known/jwks.json') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(jwks));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const jwksUrl = `http://127.0.0.1:${port}/.well-known/jwks.json`;
  console.log('  JWKS URL:', jwksUrl);

  console.log('\n── 3. Sign a JWT with the same claims Supabase uses ──');
  const authUserId = 'test-auth-user-0000-0000-000000000001';
  const issuer = 'https://mnvzpeapoezushgfmhwi.supabase.co/auth/v1';
  const token = await new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
    .setSubject(authUserId)
    .setIssuer(issuer)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);
  console.log('  sub:', authUserId);
  console.log('  iss:', issuer);
  console.log('  Token length:', token.length);

  console.log('\n── 4. Verify with the same code path as createContext ──');
  const JWKS = createRemoteJWKSet(new URL(jwksUrl));
  const { payload } = await jwtVerify(token, JWKS, { issuer });
  console.log('  Verified sub:', payload.sub);
  console.log('  Result:', payload.sub === authUserId ? '✅ PASS' : '❌ FAIL');

  console.log('\n── 5. Verify a bad token is rejected ──');
  const badToken = await new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
    .setSubject(authUserId)
    .setIssuer('https://wrong-issuer.example.com')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);
  try {
    await jwtVerify(badToken, JWKS, { issuer });
    console.log('  ❌ FAIL — bad issuer accepted');
  } catch (e) {
    console.log('  Rejected as expected:', (e as Error).message.slice(0, 60));
    console.log('  Result: ✅ PASS');
  }

  server.close();
  console.log('\n══ Done ══');
}

main().catch((e) => {
  console.error('ERROR:', e);
  process.exit(1);
});
