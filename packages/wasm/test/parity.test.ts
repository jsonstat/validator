// Cross-validation (parity) gate for the Wasm surface. Runs the SAME shared corpus
// (corpus/cases.json) through both @jsonstat-validator/ts and the Wasm wrapper, and asserts the
// findings agree — mirroring how crates/validator/tests/corpus.rs guards the Rust surface against
// the TS baseline. Together the three give a full TS ↔ Rust ↔ Wasm parity triangle.
//
// What we compare:
//  - SEMANTIC findings (the hand-written S/D/C rules): normalized `code|severity|path` multisets
//    must be IDENTICAL. This is the Option-B guarantee — the whole point of the shared manifest +
//    corpus is that the two runtimes emit the same semantic findings.
//  - STRUCTURAL findings: we only require agreement on structurally-valid-vs-invalid (both zero, or
//    both non-zero). ajv and jsonschema emit DIFFERENT NUMBERS of schema errors for the same invalid
//    document (e.g. a pre-2.0 bundle), so the count is not a meaningful parity signal — only the
//    pass/fail outcome is.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate as tsValidate } from "@jsonstat-validator/ts";
import { validate as wasmValidate } from "../src/node.js";
import type { Finding, ValidationResult } from "@jsonstat-validator/ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(
  readFileSync(path.resolve(here, "../../../corpus/cases.json"), "utf8"),
) as Array<{ id: string; group: string; input: unknown }>;

interface Split {
  semantic: string[]; // sorted "code|severity|path"
  structural: number; // count of STRUCTURAL_VIOLATION findings
}

function split(findings: Finding[]): Split {
  const semantic: string[] = [];
  let structural = 0;
  for (const f of findings) {
    if (f.code === "STRUCTURAL_VIOLATION") {
      structural += 1;
    } else {
      semantic.push(`${f.code}|${f.severity}|${f.path}`);
    }
  }
  semantic.sort();
  return { semantic, structural };
}

for (const c of cases) {
  test(`wasm parity: ${c.id}`, () => {
    const tsRes = tsValidate(c.input, { mode: "full" }) as ValidationResult;
    const wasmRes = wasmValidate(c.input, { mode: "full" }) as ValidationResult;
    const ts = split(tsRes.findings);
    const wasm = split(wasmRes.findings);

    assert.deepEqual(
      wasm.semantic,
      ts.semantic,
      `${c.id}: Wasm semantic findings differ from TS`,
    );
    assert.equal(
      wasm.structural === 0,
      ts.structural === 0,
      `${c.id}: structural validity disagrees (ts=${ts.structural}, wasm=${wasm.structural})`,
    );
    assert.equal(wasmRes.valid, tsRes.valid, `${c.id}: valid flag mismatch`);
  });
}
