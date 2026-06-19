import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env.ts";

let _client: SupabaseClient | null = null;

/** Supabase client authenticated with the service role key (server-side, bypasses RLS). */
export function db(): SupabaseClient {
  if (!_client) {
    _client = createClient(env.supabaseUrl(), env.serviceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}

/**
 * Upsert rows in batches on the given primary-key conflict target.
 * Returns the number of rows sent. Throws on the first failed batch.
 */
export async function upsertBatched(
  table: string,
  rows: Record<string, unknown>[],
  conflictColumn: string,
  batchSize = 500,
): Promise<number> {
  let sent = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await db()
      .from(table)
      .upsert(batch as never, { onConflict: conflictColumn });
    if (error) {
      throw new Error(
        `Upsert into ${table} failed at batch starting ${i}: ${error.message}`,
      );
    }
    sent += batch.length;
  }
  return sent;
}
