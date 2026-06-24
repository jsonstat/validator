// Focused unit tests for the engine and a few rules / modes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validate } from "../src/index.js";
import { analyzeDataset } from "../src/engine.js";

test("analyzeDataset computes product(size)", () => {
  const a = analyzeDataset({ id: ["a", "b"], size: [2, 3] }, 100_000_000);
  assert.equal(a.product, 6n);
  assert.equal(a.productOverflow, false);
});

test("analyzeDataset detects cube-size overflow", () => {
  const a = analyzeDataset({ size: [1_000_000, 1_000_000] }, 50_000_000);
  assert.equal(a.productOverflow, true);
  assert.equal(a.product, null);
});

test("S3 fires on dense value length mismatch", () => {
  const r = validate({
    version: "2.0", class: "dataset", id: ["x"], size: [3],
    dimension: { x: { category: { index: ["a", "b", "c"] } } }, value: [1, 2],
  });
  assert.equal(r.valid, false);
  assert.ok(r.findings.some((f) => f.code === "VALUE_LEN_MISMATCH"));
});

test("S4 fires on out-of-range sparse key", () => {
  const r = validate({
    version: "2.0", class: "dataset", id: ["x"], size: [3],
    dimension: { x: { category: { index: ["a", "b", "c"] } } }, value: { "0": 1, "9": 2 },
  });
  assert.ok(r.findings.some((f) => f.code === "SPARSE_KEY_OUT_OF_RANGE"));
});

test("structural-only mode passes a well-formed dataset", () => {
  const r = validate({
    version: "2.0", class: "dataset", id: ["x"], size: [2],
    dimension: { x: { category: { index: ["a", "b"] } } }, value: [1, 2],
  }, { mode: "structural" });
  assert.equal(r.findings.length, 0);
  assert.equal(r.valid, true);
});

test("semantic-only mode still flags cube invariants", () => {
  const r = validate({
    version: "2.0", class: "dataset", id: ["x"], size: [2],
    dimension: { x: { category: { index: ["a", "b"] } } }, value: [1],
  }, { mode: "semantic" });
  assert.ok(r.findings.some((f) => f.code === "VALUE_LEN_MISMATCH"));
});

test("result meta carries engine/ruleSet/schema versions", () => {
  const r = validate({ version: "2.0", class: "dataset", id: ["x"], size: [1], dimension: { x: { category: { index: ["a"] } } }, value: [1] });
  assert.equal(r.meta.ruleSetVersion, "1.0.0");
  assert.equal(r.meta.schemaVersion, "1.05");
  assert.ok(typeof r.meta.durationMs === "number");
});
