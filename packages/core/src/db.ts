/**
 * Postgres client for Luma Foundry.
 *
 * Uses app_user (no BYPASSRLS) so RLS policies apply. prepare: false is
 * REQUIRED for Supabase's transaction pooler.
 *
 * withUser() sets the JWT claims for the duration of a transaction, which is
 * what auth.uid() in the RLS policies reads.
 */
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
export type Db = typeof db;

/**
 * Run a query as a specific user. RLS policies read auth.uid() from
 * request.jwt.claims, which this function sets for the transaction.
 */
export async function withUser<T>(
  userId: string,
  fn: (tx: Parameters<Parameters<Db['transaction']>[0]>[0]) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId })}, true)`,
    );
    return fn(tx);
  });
}
