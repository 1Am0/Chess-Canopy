#!/usr/bin/env node
// Postbuild: tightens script-src for the static export. Next.js writes a handful of inline
// <script> tags into every page, which is why the response-header CSP (vercel.json /
// serve.json) has to allow 'unsafe-inline' for scripts. Their text is fixed per build, so
// this script hashes them and adds a <meta http-equiv="Content-Security-Policy"> to each page
// that allows only 'self' plus those exact hashes. Browsers enforce the header CSP and the
// meta CSP together, so the effective script-src is the strict one.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const INLINE_SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const NON_EXECUTABLE = /\btype\s*=\s*["']?(?:application\/(?:ld\+)?json|importmap|speculationrules)/i;
const META_MARK = 'data-csp-hashes="1"';

/** sha256 CSP source expressions of every executable inline script in `html`, in page order. */
export function inlineScriptHashes(html) {
  const out = new Set();
  for (const m of html.matchAll(INLINE_SCRIPT)) {
    const attrs = m[1];
    if (/\bsrc\s*=/i.test(attrs) || NON_EXECUTABLE.test(attrs)) continue;
    out.add(`'sha256-${createHash("sha256").update(m[2], "utf8").digest("base64")}'`);
  }
  return [...out];
}

export function cspMeta(hashes) {
  const policy = ["script-src 'self'", ...hashes].join(" ") + "; object-src 'none'; base-uri 'self'; form-action 'none'";
  return `<meta http-equiv="Content-Security-Policy" ${META_MARK} content="${policy}">`;
}

/** The page with a hash-based CSP meta right after <head> (replacing a previous one). */
export function addCspMeta(html) {
  const cleaned = html.replace(new RegExp(`<meta [^>]*${META_MARK}[^>]*>`, "g"), "");
  const meta = cspMeta(inlineScriptHashes(cleaned));
  if (!/<head[^>]*>/i.test(cleaned)) return cleaned;
  return cleaned.replace(/<head[^>]*>/i, (tag) => `${tag}${meta}`);
}

function* htmlFiles(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) yield* htmlFiles(p);
    else if (name.endsWith(".html")) yield p;
  }
}

function main() {
  const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const out = path.join(webDir, "out");
  let n = 0;
  for (const file of htmlFiles(out)) {
    writeFileSync(file, addCspMeta(readFileSync(file, "utf8")));
    n++;
  }
  console.log(`csp-hashes: added script hashes to ${n} page(s)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
