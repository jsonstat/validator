// Bundles the de-duplicated curated schemas (schemas/curated/*.json, which $ref into core.json) into
// SELF-CONTAINED per-class schemas with no external $refs. Both the TypeScript surface (via
// gen-assets.mjs -> src/generated/schemas.ts) and the Rust surface (via build.rs ->
// crates/validator/src/_vendored/schemas/) consume this bundled output, so neither runtime needs an
// external $ref retriever. This is what lets the Rust crate keep
// `jsonschema = { default-features = false }` (no HTTP/file resolver).
//
// Why bundle (not dereference): the `link` <-> `linkItemProperties` relationship is a CYCLE.
// `bundle()` (not `dereference()`) merges core.json's $defs into each per-class doc and rewrites the
// cross-file refs (core.json#/$defs/X) as INTERNAL refs (#/$defs/X), preserving the cycle as an
// internal $ref rather than infinitely expanding it. The vendored upstream originals express this
// same cycle the same way (an internal $ref inside $defs).
//
// Output is committed at schemas/curated/bundled/*.json so the Rust build.rs can copy it (a pure
// file copy, NOT a transform) into _vendored/schemas/ — which keeps vendored_parity.rs's
// byte-identity invariant valid. Run via `node tools/bundle-schemas.mjs` (or `npm run bundle`).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { $RefParser } from "@apidevtools/json-schema-ref-parser";

const here = path.dirname(fileURLToPath(import.meta.url)); // tools
const repoRoot = path.resolve(here, "..");
const curatedDir = path.join(repoRoot, "schemas", "curated");
const outDir = path.join(curatedDir, "bundled");

const NAMES = ["dataset", "collection", "dimension", "index"];

// A self-contained schema must contain no external $ref (no "core.json", no "http", no relative
// file refs). Internal $refs (#/$defs/...) are expected and fine — they express the link cycle.
function hasExternalRef(obj) {
  if (obj === null || typeof obj !== "object") return false;
  if (Array.isArray(obj)) return obj.some(hasExternalRef);
  for (const [k, v] of Object.entries(obj)) {
    if (k === "$ref" && typeof v === "string") {
      if (!v.startsWith("#")) return true; // anything not an internal pointer is external
    } else if (hasExternalRef(v)) {
      return true;
    }
  }
  return false;
}

mkdirSync(outDir, { recursive: true });

let written = 0;
for (const name of NAMES) {
  const srcFile = path.join(curatedDir, `${name}.json`);
  // Pass the FILE PATH (not the parsed object) so $RefParser's FILE resolver can resolve the
  // relative `core.json` ref from the schema's own location. Only the HTTP resolver is disabled
  // (schemas must resolve locally, never over the network). The `file` resolver stays enabled.
  const bundled = await new $RefParser().bundle(srcFile, {
    resolve: { http: false },
    dereference: { circular: true },
  });

  if (hasExternalRef(bundled)) {
    throw new Error(
      `bundle-schemas: ${name}.json still contains an external $ref after bundling; ` +
      `both runtimes require fully self-contained schemas.`,
    );
  }

  // Deterministic serialization (2-space indent, insertion order) so the committed-snapshot drift
  // guard (vendored_parity.rs) sees byte-stable output across runs and machines.
  const text = JSON.stringify(bundled, null, 2) + "\n";
  writeFileSync(path.join(outDir, `${name}.json`), text);
  written++;
}

console.log(`bundle-schemas: wrote ${written} self-contained schemas to schemas/curated/bundled/`);
