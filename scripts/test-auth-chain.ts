/**
 * End-to-end auth chain verification.
 *
 * 1. Fetches the Supabase JWKS endpoint — proves the URL format works.
 * 2. Signs up a test user via Supabase Auth — proves the signup path works.
 * 3. Verifies the returned JWT locally against the JWKS — proves createContext
 *    will accept real tokens.
 *
 * No database writes beyond the users row created by the auth trigger.
 */
import 'dotenv/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const supabaseUrl = process.env.SUPABASE_URL!;
const anonKey = process.env.SUPABASE_ANON_KEY!;

async function main() {
  console.log('══ Auth Chain Verification ══\n');

  console.log('── 1. JWKS endpoint ──');
  const jwksUrl = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
  console.log('  URL:', jwksUrl);
  const jwksRes = await fetch(jwksUrl);
  console.log('  Status:', jwksRes.status);
  if (!jwksRes.ok) {
    console.log('  ❌ JWKS not reachable — auth will fail in production');
    return;
  }
  const jwks = await jwksRes.json();
  console.log('  Keys:', (jwks.keys ?? []).length);
  console.log('  Result: ✅ PASS');

  console.log('\n── 2. Sign up test user ──');
  const email = `test-${Date.now()}@example.com`;
  const res = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'apikey': anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password: 'TestPassword123!' }),
  });
  console.log('  Status:', res.status);
  if (!res.ok) {
    console.log('  Body:', (await res.text()).slice(0, 200));
    console.log('  ❌ Signup failed');
    return;
  }
  const body = await res.json();
  const token = body.access_token;
  if (!token) {
    console.log('  Body keys:', Object.keys(body).join(', '));
    console.log('  ❌ No access_token — email confirmation may be required');
    return;
  }
  console.log('  Email:', email);
  console.log('  Token length:', token.length);
  console.log('  Result: ✅ PASS');

  console.log('\n── 3. Verify JWT with same code path as createContext ──');
  const JWKS = createRemoteJWKSet(new URL(jwksUrl));
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${supabaseUrl}/auth/v1`,
    });
    console.log('  sub:', payload.sub);
    console.log('  iss:', payload.iss);
    console.log('  Result: ✅ PASS — createContext will accept real Supabase JWTs');
  } catch (e) {
    console.log('  ❌ jwtVerify failed:', (e as Error).message);
    console.log('  This is what would break in production.');
  }

  console.log('\n══ Done ══');
  console.log('Note: a test user was created. Clean up via Supabase Auth dashboard.');
}

main();
