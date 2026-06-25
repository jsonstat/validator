// Generates src/generated/{manifest-data,schemas}.ts from the repo-root SINGLE sources of truth
// (../../rules-manifest.json and ../../schemas/vendored/*.json). The Rust surface reads those same
// files via include_str!, so the two runtimes stay in lockstep.
//
// The output is bundled as TS data modules (NOT read at runtime via node:fs) so the published
// package is self-contained and browser/CDN-safe. Output is gitignored — always regenerated, never
// hand-edited. Run via `npm run gen`.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url)); // packages/ts/tools
const pkgRoot = path.resolve(here, "..");                   // packages/ts
const repoRoot = path.resolve(pkgRoot, "..", "..");         // repo root

const outDir = path.join(pkgRoot, "src", "generated");
mkdirSync(outDir, { recursive: true });

const manifest = JSON.parse(
  readFileSync(path.join(repoRoot, "rules-manifest.json"), "utf8"),
);
writeFileSync(
  path.join(outDir, "manifest-data.ts"),
  "// AUTO-GENERATED from ../../rules-manifest.json by tools/gen-assets.mjs — DO NOT EDIT.\n" +
  "// Regenerate with `npm run gen`. This mirrors the Rust surface's include_str! of the same file.\n" +
  "const manifest = " + JSON.stringify(manifest, null, 2) + ";\n" +
  "export default manifest;\n",
);

const vendored = path.join(repoRoot, "schemas", "vendored");
const names = ["dataset", "collection", "dimension", "index"];
const parts = [];
for (const n of names) {
  const schema = JSON.parse(readFileSync(path.join(vendored, `${n}.json`), "utf8"));
  parts.push("export const " + n + " = " + JSON.stringify(schema, null, 2) + ";");
}
writeFileSync(
  path.join(outDir, "schemas.ts"),
  "// AUTO-GENERATED from ../../schemas/vendored/*.json by tools/gen-assets.mjs — DO NOT EDIT.\n" +
  "// Regenerate with `npm run gen`.\n\n" +
  parts.join("\n\n") + "\n",
);

console.log("gen-assets: wrote src/generated/manifest-data.ts, src/generated/schemas.ts");
