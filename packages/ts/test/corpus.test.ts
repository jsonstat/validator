// Corpus-driven end-to-end tests. Reads the single shared corpus/cases.json (also consumed by
// the Rust parity suite) and asserts each case's expectation against validate().
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(readFileSync(path.resolve(here, "../../../corpus/cases.json"), "utf8")) as Array<{
  id: string;
  group: "valid" | "invalid";
  input: unknown;
  expected: { codes?: string[]; valid?: boolean; noOtherErrors?: boolean };
}>;

for (const c of cases) {
  test(`corpus: ${c.id}`, () => {
    const result = validate(c.input, { mode: "full" });
    const codes = result.findings.map((f) => f.code);
    if (c.group === "valid") {
      assert.equal(result.valid, true, `${c.id}: expected valid, got [${codes.join(", ")}]`);
      assert.equal(result.findings.filter((f) => f.severity === "error").length, 0, `${c.id}: unexpected error findings`);
    } else {
      const exp = c.expected;
      for (const code of exp.codes ?? []) {
        assert.ok(codes.includes(code), `${c.id}: expected code ${code} in [${codes.join(", ")}]`);
      }
      if (exp.noOtherErrors !== false) {
        const errs = result.findings.filter((f) => f.severity === "error").map((f) => f.code);
        for (const e of errs) assert.ok((exp.codes ?? []).includes(e), `${c.id}: unexpected error ${e}`);
      }
      if (exp.valid !== undefined) {
        assert.equal(result.valid, exp.valid, `${c.id}: valid mismatch (expected ${exp.valid})`);
      }
    }
  });
}
