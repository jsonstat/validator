// Curated≡vendored structural parity: asserts the de-duplicated, bundled curated schemas
// (schemas/curated/bundled/*.json — produced by tools/bundle-schemas.mjs) are SEMANTICALLY
// EQUIVALENT to the verbatim upstream originals (schemas/vendored/*.json) on every corpus case.
//
// This is the DESIGN.md §2.3 guard: de-duplication must never silently change structural
// outcomes. We compare pass/fail AND the set of violation instancePaths (so a schema that passes
// for the wrong reason, or fails at a different node, is caught — not just the boolean).
//
// Compiler-flag note: the vendored `updated` pattern uses an invalid `\-` escape, so its compiler
// needs `unicodeRegExp: false`; the curated set writes the hyphen literally and compiles CLEANLY
// under the default Unicode RegExp. That flag difference is the bug the curated set fixes; the
// OUTCOME parity we assert here is what proves the fix is behavior-preserving.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// @ts-ignore - ajv/dist/2020.js declaration resolution varies across ajv versions
import Ajv2020 from "ajv/dist/2020.js";
// @ts-ignore
import addFormats from "ajv-formats";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..", "..");

function load(dir: string) {
  const names = ["dataset", "collection", "dimension", "index"] as const;
  const out: Record<string, any> = {};
  for (const n of names) out[n] = JSON.parse(readFileSync(path.join(root, dir, `${n}.json`), "utf8"));
  return out;
}

const vendored = load(path.join("schemas", "vendored"));
const curated = load(path.join("schemas", "curated", "bundled"));

// `cleanRegexp=false` applies the legacy `unicodeRegExp:false` workaround the vendored set needs.
function compile(schema: any, cleanRegexp: boolean) {
  const ajv = new (Ajv2020 as any)({
    allErrors: true,
    strict: false,
    ...(cleanRegexp ? {} : { unicodeRegExp: false }),
  });
  (addFormats as any)(ajv);
  return ajv.compile(schema);
}

const compiled = {
  vendored: {
    dataset: compile(vendored.dataset, false),
    collection: compile(vendored.collection, false),
    dimension: compile(vendored.dimension, false),
    index: compile(vendored.index, false),
  },
  curated: {
    dataset: compile(curated.dataset, true),
    collection: compile(curated.collection, true),
    dimension: compile(curated.dimension, true),
    index: compile(curated.index, true),
  },
};

function pickKey(cls: unknown): "dataset" | "collection" | "dimension" | "index" {
  if (cls === "dataset") return "dataset";
  if (cls === "collection") return "collection";
  if (cls === "dimension") return "dimension";
  return "index";
}

// Normalized violation signature: sorted set of instancePaths. `allErrors` ordering is not
// guaranteed, so compare as a set. The `keyword` is intentionally NOT compared: ajv may emit
// different keyword sequences for equivalent schemas (e.g. oneOf vs anyOf expansion paths).
function signature(validate: any, doc: unknown): { ok: boolean; paths: string[] } {
  const ok = !!validate(doc);
  const errs = (validate.errors ?? []) as Array<{ instancePath: string }>;
  const paths = errs.map((e) => e.instancePath || "/").sort();
  return { ok, paths };
}

const cases = JSON.parse(readFileSync(path.join(root, "corpus", "cases.json"), "utf8")) as Array<{
  id: string;
  input: unknown;
}>;

test("curated≡vendored: identical structural outcomes on every corpus case", () => {
  const mismatches: string[] = [];
  for (const c of cases) {
    const key = pickKey((c.input as any)?.class);
    const v = signature(compiled.vendored[key], c.input);
    const b = signature(compiled.curated[key], c.input);
    if (v.ok !== b.ok) {
      mismatches.push(`${c.id} [${key}]: ok vendored=${v.ok} curated=${b.ok}`);
    } else if (JSON.stringify(v.paths) !== JSON.stringify(b.paths)) {
      mismatches.push(
        `${c.id} [${key}]: paths differ\n      vendored=${JSON.stringify(v.paths)}\n      curated =${JSON.stringify(b.paths)}`,
      );
    }
  }
  assert.equal(
    mismatches.length,
    0,
    `curated≡vendored structural parity failed (${mismatches.length}):\n${mismatches.join("\n")}`,
  );
});

test("curated schemas compile under the default Unicode RegExp (no unicodeRegExp workaround)", () => {
  // If this throws, the `\-`-style escape regressed into the curated set.
  assert.doesNotThrow(() => compile(curated.dataset, true));
  assert.doesNotThrow(() => compile(curated.collection, true));
  assert.doesNotThrow(() => compile(curated.dimension, true));
  assert.doesNotThrow(() => compile(curated.index, true));
});

test("curated schemas are self-contained (no external $ref after bundling)", () => {
  function hasExternalRef(obj: any): boolean {
    if (obj === null || typeof obj !== "object") return false;
    if (Array.isArray(obj)) return obj.some(hasExternalRef);
    return Object.entries(obj).some(
      ([k, v]) =>
        (k === "$ref" && typeof v === "string" && !v.startsWith("#")) || hasExternalRef(v),
    );
  }
  for (const n of ["dataset", "collection", "dimension", "index"] as const) {
    assert.equal(hasExternalRef(curated[n]), false, `${n}.json has an external $ref (not bundled)`);
  }
});
