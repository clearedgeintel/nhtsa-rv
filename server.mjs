// Minimal zero-dependency static server for the built SPA (dist/). Used in production on
// Railway: `node server.mjs`. Serves assets with long cache, falls back to index.html for
// client-side routes, binds 0.0.0.0:$PORT.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("./dist/", import.meta.url));
const PORT = process.env.PORT || 8080;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webp": "image/webp",
  ".woff2": "font/woff2", ".woff": "font/woff", ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

async function readDist(relPath) {
  const safe = normalize(relPath).replace(/^(\.\.[/\\])+/, "");
  const full = join(DIST, safe);
  if (!full.startsWith(DIST)) throw new Error("bad path");
  return readFile(full);
}

const server = createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent((req.url || "/").split("?")[0]);
    if (pathname.endsWith("/")) pathname += "index.html";
    let ext = extname(pathname);
    let data;
    try {
      data = await readDist(pathname);
    } catch {
      if (ext) throw new Error("not found"); // missing asset → 404
      data = await readDist("/index.html"); // SPA route → index.html
      ext = ".html";
    }
    // Long-cache only content-hashed assets. The HTML shell, the service worker, and the
    // manifest must revalidate so updates (and SW upgrades) actually propagate.
    const noCache = ext === ".html" || ext === ".webmanifest" || pathname === "/sw.js";
    const cache = noCache ? "no-cache" : "public, max-age=31536000, immutable";
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": cache });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
});

server.listen(PORT, "0.0.0.0", () => console.log(`serving ./dist on http://0.0.0.0:${PORT}`));
