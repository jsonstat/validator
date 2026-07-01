// Generates src/generated/{manifest-data,schemas}.ts from the repo-root SINGLE sources of truth
// (../../rules-manifest.json and the BUNDLED curated schemas in ../../schemas/curated/bundled/).
// The Rust surface embeds the same bundled files via include_str!, so the two runtimes stay in
// lockstep.
//
// SCHEMA SOURCE: this consumes schemas/curated/bundled/*.json — the SELF-CONTAINED output of the
// root tools/bundle-schemas.mjs bundler (which inlines the de-duplicated schemas/curated/*.json
// that $ref into core.json). The verbatim upstream originals live untouched in schemas/vendored/;
// a curated-equiv-vendored parity test (CI) asserts the bundled set is semantically equivalent.
// As of 1.0.0 the validator loads CURATED-BUNDLED by default (the vendored set is kept only as the
// quote source + parity baseline). The curated set also fixes the `\-` RegExp escape the vendored
// `updated` pattern carries, so this compiles under a Unicode-flag RegExp with no workaround.
//
// The output is bundled as TS data modules (NOT read at runtime via node:fs) so the published
// package is self-contained and browser/CDN-safe. Output is gitignored — always regenerated, never
// hand-edited. Run via `npm run gen` (which first runs the bundler, then this).
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

const bundledDir = path.join(repoRoot, "schemas", "curated", "bundled");
const names = ["dataset", "collection", "dimension", "index"];
const parts = [];
for (const n of names) {
  const schema = JSON.parse(readFileSync(path.join(bundledDir, `${n}.json`), "utf8"));
  parts.push("export const " + n + " = " + JSON.stringify(schema, null, 2) + ";");
}
writeFileSync(
  path.join(outDir, "schemas.ts"),
  "// AUTO-GENERATED from ../../schemas/curated/bundled/*.json by tools/gen-assets.mjs — DO NOT EDIT.\n" +
  "// Source: schemas/curated/*.json ($ref into core.json), bundled by tools/bundle-schemas.mjs.\n" +
  "// Vendored upstream originals in schemas/vendored/ are kept as the parity baseline only.\n" +
  "// Regenerate with `npm run gen` (runs the bundler first).\n\n" +
  parts.join("\n\n") + "\n",
);

console.log("gen-assets: wrote src/generated/manifest-data.ts, src/generated/schemas.ts (curated/bundled source)");
