import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { addCspMeta, inlineScriptHashes } from "../scripts/csp-hashes.mjs";

const sha = (s: string) => `'sha256-${createHash("sha256").update(s).digest("base64")}'`;

describe("csp-hashes postbuild", () => {
  const html =
    '<!DOCTYPE html><html><head><meta charset="utf-8"><script src="/a.js" async></script>' +
    "<script>self.__next_f=[]</script><script id=\"x\" type=\"application/json\">{\"a\":1}</script></head>" +
    "<body><script>window.x=1</script><script>self.__next_f=[]</script></body></html>";

  it("hashes executable inline scripts once, skipping src and JSON data blocks", () => {
    expect(inlineScriptHashes(html)).toEqual([sha("self.__next_f=[]"), sha("window.x=1")]);
  });

  it("adds one strict CSP meta right after <head> and is idempotent", () => {
    const once = addCspMeta(html);
    expect(once).toMatch(/<head><meta http-equiv="Content-Security-Policy"/);
    expect(once).toContain(`script-src 'self' ${sha("self.__next_f=[]")} ${sha("window.x=1")}`);
    expect(once).toContain("object-src 'none'");
    expect(once).not.toContain("unsafe-inline");
    expect(addCspMeta(once)).toBe(once);
  });
});
