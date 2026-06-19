// Centralized env access for ingestion scripts. Run scripts with Node's --env-file=.env
// (tsx forwards it), e.g.  `npm run ingest:01`.

function required(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return v.trim();
}

function optional(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

export const env = {
  // Used by 01–05 to write the RV slice (bypasses RLS).
  supabaseUrl: () => required("SUPABASE_URL"),
  serviceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  // Used by 04 (classification).
  anthropicKey: () => required("ANTHROPIC_API_KEY"),
  // Used by 05 (embeddings).
  voyageKey: () => required("VOYAGE_API_KEY"),
};

// Local staging dir for downloaded/extracted flat files (gitignored).
export const DATA_DIR = optional("INGEST_DATA_DIR", "ingest/.data");
