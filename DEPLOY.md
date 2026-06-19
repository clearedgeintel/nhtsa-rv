# Deploying the frontend to Railway

The **agent runs on Supabase** (Edge Function `ask`, already deployed). Railway only hosts
the static React SPA. Railway builds the app and serves `dist/` via `server.mjs`.

## How it's wired
- `railway.json` → build `npm run build`, start `node server.mjs`, healthcheck `/`.
- `server.mjs` → zero-dep static server: long-cache assets, SPA fallback to `index.html`,
  binds `0.0.0.0:$PORT` (Railway sets `$PORT`).
- Build-essential deps live in `dependencies` so the build works even if Railway installs
  with `NODE_ENV=production`.

## Required environment variables (set in Railway → Variables)
These are **build-time** (Vite inlines `VITE_*` at build) and all **public-safe**:

```
VITE_SUPABASE_URL=https://fregfziilhxrbpgpxrlo.supabase.co
VITE_SUPABASE_ANON_KEY=<legacy anon JWT — the eyJ... value from .env>
VITE_ASK_FUNCTION_URL=https://fregfziilhxrbpgpxrlo.supabase.co/functions/v1/ask
```

> Use the **legacy anon JWT** (not the `sb_publishable_…` key) — the function uses
> `verify_jwt`, which needs a JWT. Copy the value from your local `.env`.

Do NOT set any server secrets here (ANTHROPIC/VOYAGE/service-role keys live only in the
Supabase function). Don't set `NODE_ENV=production` as a variable unless you've confirmed
the build still installs build deps.

## Deploy

### Option A — Railway CLI (deploy from this folder, no GitHub needed)
```bash
npm i -g @railway/cli
railway login
railway init            # create/select a project
# add the 3 VITE_ vars in the dashboard (or: railway variables set KEY=value)
railway up              # builds + deploys this directory
railway domain          # generate a public URL
```

### Option B — GitHub integration
1. Push this repo to a GitHub remote.
2. Railway → New Project → Deploy from GitHub repo → pick it.
3. Add the 3 `VITE_` variables.
4. Railway auto-builds on push; generate a domain under Settings → Networking.

## After deploy
- Open the Railway URL and ask a question — it should hit the Supabase function (CORS is
  already `*`, so the new domain works with no change).
- If answers fail with auth errors, double-check `VITE_SUPABASE_ANON_KEY` is the JWT.
