// agent/sql_guard.ts — defense-in-depth validation for the execute_sql tool (CLAUDE.md §7.3/§7.4).
// The agent_readonly DB role is the real cage (SELECT on v_* views only, read-only tx,
// statement_timeout). This layer rejects obviously-bad input before it ever reaches Postgres
// and guarantees a row cap. Pure + dependency-free so it runs in Deno and under Node tests.

const FORBIDDEN = [
  "insert", "update", "delete", "drop", "alter", "create", "truncate", "grant",
  "revoke", "comment", "copy", "merge", "call", "do", "vacuum", "analyze",
  "reindex", "cluster", "lock", "set", "reset", "begin", "commit", "rollback",
  "savepoint", "prepare", "execute", "listen", "notify", "attach", "detach",
];

export type GuardResult =
  | { ok: true; sql: string }
  | { ok: false; error: string };

/** Replace single-quoted string literals with '' so keyword/semicolon scans ignore text. */
function stripLiterals(sql: string): string {
  return sql.replace(/'(?:''|[^'])*'/g, "''");
}

export const DEFAULT_ROW_LIMIT = 1000;

/**
 * Validate a model-supplied query and return an execution-ready statement, or an error.
 * Accepts a single read-only SELECT (or WITH…SELECT); appends a LIMIT if absent.
 */
export function guardSql(raw: string, rowLimit = DEFAULT_ROW_LIMIT): GuardResult {
  if (!raw || !raw.trim()) return { ok: false, error: "Empty query." };
  let sql = raw.trim();

  // No comments — they can hide a second statement or intent.
  const scan = stripLiterals(sql);
  if (scan.includes("--") || scan.includes("/*")) {
    return { ok: false, error: "Comments are not allowed." };
  }

  // Single statement only: at most one trailing semicolon.
  const noTrailing = scan.replace(/;\s*$/, "");
  if (noTrailing.includes(";")) {
    return { ok: false, error: "Only a single statement is allowed." };
  }
  // Strip the trailing semicolon from the real SQL for execution.
  sql = sql.replace(/;\s*$/, "");

  const lower = noTrailing.toLowerCase().trim();
  if (!(lower.startsWith("select") || lower.startsWith("with"))) {
    return { ok: false, error: "Query must start with SELECT or WITH." };
  }

  // Reject any DDL/DML keyword (word-boundary match on the literal-stripped text).
  for (const kw of FORBIDDEN) {
    if (new RegExp(`\\b${kw}\\b`, "i").test(noTrailing)) {
      return { ok: false, error: `Disallowed keyword: ${kw}.` };
    }
  }

  // Block catalog / internal schema access.
  if (/\b(pg_[a-z_]+|information_schema)\b/i.test(noTrailing)) {
    return { ok: false, error: "Access to pg_* / information_schema is not allowed." };
  }

  // Guarantee a row cap.
  if (!/\blimit\b/i.test(noTrailing)) {
    sql = `${sql}\nlimit ${rowLimit}`;
  }

  return { ok: true, sql };
}
