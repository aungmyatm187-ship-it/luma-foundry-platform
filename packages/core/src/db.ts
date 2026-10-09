/**
 * Postgres client for Luma Foundry — lazy-initialized.
 *
 * The connection is created on first query, not at module import. That means
 * importing @luma/core in tests does not require DATABASE_URL to be set.
 * Only code that actually runs a query needs the database configured.
 *
 * Uses app_user (no BYPASSRLS) so RLS policies apply. prepare: false is
 * required for Supabase's transaction pooler.
 */
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema.js';

export type Db = PostgresJsDatabase<typeof schema>;

let cached: Db | null = null;

function getDb(): Db {
  if (cached) return cached;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. DrizzleRepository cannot connect. Set it in .env or the environment.',
    );
  }
  const client = postgres(connectionString, { prepare: false });
  cached = drizzle(client, { schema });
  return cached;
}

/**
 * Run a callback inside a transaction scoped to one user.
 * Sets request.jwt.claims for the transaction duration so auth.uid() returns
 * the given UUID and RLS policies apply.
 */
export async function withUser<T>(
  userId: string,
  fn: (tx: Parameters<Parameters<Db['transaction']>[0]>[0]) => Promise<T>,
): Promise<T> {
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId })}, true)`,
    );
    return fn(tx);
  });
}
