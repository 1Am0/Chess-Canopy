import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildServeConfig, toServeSource } from "../scripts/sync-serve-headers.mjs";

const read = (rel: string) => JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));
const vercel = read("../vercel.json");
const serve = read("../serve.json");

describe("serve.json mirrors vercel.json headers (e2e runs under production CSP)", () => {
  it("serve.json equals the output of scripts/sync-serve-headers.mjs (run `pnpm start` or the script to regenerate)", () => {
    expect(serve).toEqual(buildServeConfig(vercel));
  });

  it("every vercel header rule is present in serve.json with identical key/value pairs", () => {
    const flatten = (cfg: { headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }> }) =>
      cfg.headers.flatMap((rule) => rule.headers.map((h) => `${h.key}: ${h.value}`));
    expect(flatten(serve)).toEqual(flatten(vercel));
  });

  it("the Content-Security-Policy header is present and non-empty", () => {
    const csp = serve.headers.flatMap((r: { headers: Array<{ key: string; value: string }> }) => r.headers).find(
      (h: { key: string }) => h.key === "Content-Security-Policy",
    );
    expect(csp?.value).toMatch(/default-src 'self'/);
  });

  it("translates the path-to-regexp source '/(.*)' into the glob serve-handler matches", () => {
    expect(toServeSource("/(.*)")).toBe("**");
  });
});
