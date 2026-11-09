#!/usr/bin/env node
// Copies the production response headers from vercel.json into serve.json so the
// local static server used by `pnpm start` (and therefore the e2e run) serves
// out/ under the same CSP as Vercel. Runs automatically as `prestart`.
// tests/csp-sync.test.ts fails if the committed serve.json drifts from this output.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Vercel sources are path-to-regexp ("/(.*)"); serve-handler matches header sources
// as globs, where "**" is the equivalent of "/(.*)" for every path.
export function toServeSource(source) {
  return source.replace(/^\//, "").replace(/\(\.\*\)/g, "**");
}

export function buildServeConfig(vercel) {
  const headers = (vercel.headers ?? []).map((rule) => ({
    source: toServeSource(rule.source),
    headers: rule.headers.map(({ key, value }) => ({ key, value })),
  }));
  return { headers };
}

function main() {
  const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const vercel = JSON.parse(readFileSync(path.join(webDir, "vercel.json"), "utf8"));
  const serve = buildServeConfig(vercel);
  writeFileSync(path.join(webDir, "serve.json"), `${JSON.stringify(serve, null, 2)}\n`);
  console.log(`serve.json: synced ${serve.headers.length} header rule(s) from vercel.json`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
