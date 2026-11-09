// Stub: another agent replaces this with the real openings generator.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const target = fileURLToPath(new URL("../lib/openings/openings.json", import.meta.url));
if (existsSync(target)) {
  console.log("openings.json present, skipping generation");
  process.exit(0);
}
console.warn("openings.json missing and generator not implemented yet (stub)");
process.exit(0);
