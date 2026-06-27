# jsonstat-validator

A **semantic** validator for [JSON-stat](https://json-stat.org/) 2.0. It **reuses** the official JSON
Schema 2020-12 definitions for the *structural* pass and layers on top a rules engine that checks the
cross-field cube invariants JSON Schema cannot express.

> Designed in [`DESIGN.md`](./DESIGN.md). Architectural companion to the
> [LLM-Wiki](https://github.com/jsonstat/llm-wiki) JSON-stat knowledge base.

---

## Why

JSON Schema can validate *shape* (required properties, `oneOf`s, enums, the IANA link regex) but
cannot express relationships like "`value` array length must equal the product of `size`". This
package implements exactly those checks (the S/D/C catalogue) with a stable, versioned error-code
vocabulary.

```json-stat
{
  "version": "2.0",
  "class": "dataset",
  "id": ["sex", "year"],
  "size": [2, 3],
  "dimension": { "sex": { "category": { "index": ["M", "F"] } }, "year": { "category": { "index": { "2022": 0, "2023": 1, "2024": 2 } } } },
  "value": [10, 20, 30, 40, 50]
}
```

A schema engine says "this is shaped like a dataset". `jsonstat-validator` tells you the actual
problem: `value` has 5 entries but `product(size)` is `2 × 3 = 6` — see
[`VALUE_LEN_MISMATCH`](#error-codes).

---

## Install

Pick the surface that matches your stack. They all share **one**
[`rules-manifest.json`](rules-manifest.json) and **one** [`corpus/cases.json`](corpus/cases.json), so
they produce identical findings on identical input.

| Surface | Package | Install |
|---|---|---|
| **TypeScript / Node** | [`@jsonstat-validator/ts`](https://www.npmjs.com/package/@jsonstat-validator/ts) | `npm i @jsonstat-validator/ts` |
| **CLI** | [`jsonstat-validate`](https://www.npmjs.com/package/jsonstat-validate) | `npx jsonstat-validate` (no install) |
| **Browser / CDN** | — | `<script src>` (see [Web / CDN](#web--cdn)) |
| **Rust** | [`jsonstat-validator`](https://crates.io/crates/jsonstat-validator) | `cargo add jsonstat-validator` |
| **Wasm (JS)** | [`@jsonstat-validator/wasm`](https://www.npmjs.com/package/@jsonstat-validator/wasm) | `npm i @jsonstat-validator/wasm` |

---

## Quick start — TypeScript / Node

```bash
npm install @jsonstat-validator/ts
```

```ts
import { validate } from "@jsonstat-validator/ts";

const result = validate(doc);          // doc may be an object OR a JSON string
console.log(result.valid);             // true / false
console.log(result.summary);           // { errors, warnings, infos, structuralErrors, byCode }
for (const f of result.findings) {     // Finding[] — empty when valid
  console.log(`[${f.severity}] ${f.code}  ${f.path}  — ${f.message}`);
}
```

`validate()` accepts a parsed object **or** a raw JSON string (it parses for you). To validate a file
on disk, use the async [`validateFile()`](packages/ts/src/pipeline.ts):

```ts
import { validateFile } from "@jsonstat-validator/ts";
const result = await validateFile("./my-cube.json");
```

### What the result looks like

```jsonc
{
  "valid": false,
  "findings": [
    {
      "code": "VALUE_LEN_MISMATCH",
      "ruleId": "S3",
      "severity": "error",
      "path": "/value",
      "message": "Dense 'value' length 5 must equal product(size) = 6.",
      "expected": 6,
      "actual": 5,
      "specRef": "wiki/format-specification.md"
    }
  ],
  "summary": { "errors": 1, "warnings": 0, "infos": 0, "structuralErrors": 0, "byCode": { "VALUE_LEN_MISMATCH": 1 } },
  "options": { /* resolved ValidateOptions */ },
  "meta": { "engineVersion": "0.2.0", "ruleSetVersion": "1.0.0", "schemaVersion": "1.05", "durationMs": 3 }
}
```

Structural (JSON Schema) violations are normalized into the **same** shape with `code: "STRUCTURAL_VIOLATION"` and the offending keyword kept in `meta` — so consumers only ever handle one finding shape.

### Tuning a run

```ts
validate(doc, {
  mode: "full",              // "full" | "structural" | "semantic"
  minSeverity: "info",       // "error" | "warning" | "info" — filters returned findings
  maxCollectionDepth: 3,     // cap nested-collection recursion
  continueOnStructuralError: true,
  budget: { maxCells: 50_000_000, maxBytes: 200 * 1024 * 1024, maxFindings: 1000 },
  onFinding: (f) => { /* streaming sink, for very large docs */ },
});
```

---

## Quick start — CLI

No install needed — run it once with `npx`:

```bash
# validate a file
npx jsonstat-validate my-cube.json

# validate JSON on stdin (note the `-`)
echo '{"version":"2.0","class":"dataset","id":["x"],"size":[2],"dimension":{"x":{"category":{"index":["a","b"]}}},"value":[1]}' \
  | npx jsonstat-validate -

# machine-readable output for CI
npx jsonstat-validate my-cube.json --format json
```

```
$ npx jsonstat-validate my-cube.json
valid: false
summary: 1 errors, 0 warnings, 0 infos, 0 structural
  [error] VALUE_LEN_MISMATCH  /value  — Dense 'value' length 1 must equal product(size) = 2.
```

**Exit code** is `0` when valid, `1` when invalid — drop it straight into a pipeline or pre-commit hook:

```bash
npx jsonstat-validate data/*.json || exit 1
```

Options:

```
jsonstat-validate <file|-> [options]
  --mode full|structural|semantic   validation phases to run (default: full)
  --format json|text                output format (default: text)
  --min-severity error|warning|info only show findings at/above this severity (default: info)
  --structural-only                 alias for --mode structural
  --semantic-only                   alias for --mode semantic
```

---

## Quick start — Web / CDN

The TS package is dependency-light and browser-safe, so you can use it straight from a CDN with no
build step. Works on [esm.sh](https://esm.sh/), [jsDelivr](https://www.jsdelivr.com/), and
[unpkg](https://unpkg.com/).

### `<script type="module">` (recommended)

```html
<script type="module">
  // esm.sh serves the ESM browser build:
  import { validate } from "https://esm.sh/@jsonstat-validator/ts";
  // or jsDelivr / unpkg:
  // import { validate } from "https://cdn.jsdelivr.net/npm/@jsonstat-validator/ts/+esm";

  const result = validate(myJsonstatDocument);
  console.log(result.valid, result.summary);
</script>
```

### Classic `<script src>` (global `JsonstatValidator`)

```html
<!-- Minified IIFE bundle from jsDelivr (also on unpkg) -->
<script src="https://cdn.jsdelivr.net/npm/@jsonstat-validator/ts/dist/browser/jsonstat-validator.min.js"></script>
<script>
  const { validate } = window.JsonstatValidator;
  const result = validate(myJsonstatDocument);
  console.log(result.valid, result.findings);
</script>
```

> The browser build excludes [`validateFile()`](packages/ts/src/browser.ts) (it needs `node:fs`).
> Use `validate()` in the browser and fetch the document yourself.

### Bundled in an app (Vite, webpack, Rollup, …)

```bash
npm install @jsonstat-validator/ts
```

```ts
import { validate } from "@jsonstat-validator/ts";
```

The package's `exports` map points bundlers at the browser build automatically, so the same import
works in Node and the browser with no special config.

---

## Quick start — Rust

```bash
cargo add jsonstat-validator
```

```rust
use jsonstat_validator::{validate_from_str, ValidateOptions};

fn main() {
    let result = validate_from_str(json, &ValidateOptions::default());
    println!("valid: {}", result.valid);
    for f in &result.findings {
        println!("[{}] {} {} — {}", f.severity, f.code, f.path, f.message);
    }
}
```

Or build and run the example binary directly from a checkout:

```bash
cd crates/validator && cargo test                       # corpus parity
echo '{"version":"2.0","class":"dataset","id":["x"],"size":[2],"dimension":{"x":{"category":{"index":["a","b"]}}},"value":[1]}' \
  | cargo run --example validate -- -
```

---

## Quick start — Wasm

The Wasm surface is a thin JS wrapper over the Rust crate, exposing the **same `validate()` shape**
as `@jsonstat-validator/ts`. The crate is compiled to WebAssembly with
[`wasm-pack`](https://rustwasm.github.io/wasm-pack/) (`--target web`).

```bash
npm install @jsonstat-validator/wasm
```

```ts
import { init, validate } from "@jsonstat-validator/wasm";

await init();                       // load the .wasm once (the browser fetches it)
const result = validate(doc);       // same ValidationResult shape as @jsonstat-validator/ts
console.log(result.valid, result.summary);
```

In Node, import from `@jsonstat-validator/wasm/node` instead — it auto-loads the `.wasm` from disk
and also exports `validateFile()`. See [`packages/wasm/README.md`](packages/wasm/README.md) for the
full surface, and note that `options.onFinding` / `options.budget` are not carried across the
JS↔wasm boundary (findings are still returned in full).

> The Wasm surface emits the **same semantic findings** as the TS and Rust surfaces — enforced by a
> TS↔Wasm corpus parity test that runs in CI.

---

## Error codes

See [`rules-manifest.json`](rules-manifest.json) for the authoritative, append-only catalogue. Codes
include `VALUE_LEN_MISMATCH`, `SPARSE_KEY_OUT_OF_RANGE`, `STATUS_LEN_MISMATCH`, `DIM_KEY_ID_MISMATCH`,
`ID_SIZE_LEN_MISMATCH`, `ROLE_ID_UNKNOWN`, `INDEX_COUNT_MISMATCH`, `INDEX_POSITIONS_INVALID`,
`LABEL_KEY_UNKNOWN`, `UNIT_KEY_UNKNOWN`, `COORD_KEY_UNKNOWN`, `NOTE_KEY_UNKNOWN`, `CHILD_ID_UNKNOWN`,
`CHILD_CYCLE`, `METRIC_UNIT_MISSING` (warning), `BUNDLE_DEPRECATED` (info), `CUBE_SIZE_OVERFLOW`,
`PARSE_ERROR`, and `STRUCTURAL_VIOLATION`. The vocabulary is versioned independently
(`meta.ruleSetVersion`) from the package SemVer — see [`DESIGN.md §4.4`](./DESIGN.md) for the full
S/D/C rule table.

---

## Building from source

The repo is an npm workspace plus a Cargo crate. From a checkout:

```bash
# TypeScript: npm install runs the `prepare` hook, which auto-builds both
# workspaces (so `npx jsonstat-validate` works immediately) and re-links the bin.
npm install
npm test                 # 27/27 corpus + rule tests

# After editing TS/CLI sources, rebuild:
npm run build            # regenerates @jsonstat-validator/ts and jsonstat-validate

# Rust:
cargo test --manifest-path crates/validator/Cargo.toml
```

### How the published package stays self-contained

The manifest and vendored schemas live at the repo root as the single source of truth shared with the
Rust surface. They are **not** read from disk at runtime (that would break `npm publish` and browser
use). Instead [`packages/ts/tools/gen-assets.mjs`](packages/ts/tools/gen-assets.mjs) compiles them into
[`packages/ts/src/generated/`](packages/ts/src/generated/) TypeScript modules at build time, so the
published tarball carries everything it needs. The Rust crate does the equivalent with `include_str!`.

### Producing the browser bundle

[`packages/ts/tools/build-browser.mjs`](packages/ts/tools/build-browser.mjs) uses
[esbuild](https://esbuild.github.io/) to emit two self-contained files under `dist/browser/`:
`jsonstat-validator.min.js` (IIFE, global `JsonstatValidator`) and `jsonstat-validator.mjs` (ESM).

---

## Roadmap

- **M1/M2** ✅ TypeScript engine, full rule set, corpus, CLI.
- **M3** ✅ Rust port + corpus parity.
- **M4** ✅ Wasm surface: the crate compiles to WebAssembly (`wasm-pack -t web`, with
  `RUSTFLAGS='--cfg getrandom_backend="wasm_js"'`); the [`@jsonstat-validator/wasm`](packages/wasm)
  JS wrapper exposes the same `validate()` shape as the TS package; and a TS↔Wasm corpus parity test
  ([`packages/wasm/test/parity.test.ts`](packages/wasm/test/parity.test.ts)) runs in CI, completing
  the TS ↔ Rust ↔ Wasm parity triangle. (The parity test surfaced two required crate fixes:
  `std::time::Instant` panics on `wasm32-unknown-unknown`, so it is replaced by a no-op `Timer` on
  that target; and `console_error_panic_hook` is installed so panics appear as readable console
  messages instead of an opaque `unreachable` trap.)
- **M5** ⏳ npm + crates.io publish, `curated/` de-duplicated schemas (with curated≡vendored parity
  test), full CI/release.
- **Follow-up** ✅ Rust crate `_vendored` parity test —
  [`crates/validator/tests/vendored_parity.rs`](crates/validator/tests/vendored_parity.rs) asserts
  the committed snapshot stays byte-identical to the repo-root sources
  ([`rules-manifest.json`](rules-manifest.json), [`schemas/vendored/*.json`](schemas/vendored)).
  It compares **committed (`git HEAD`) blobs**, not the working tree — `build.rs` re-syncs the
  working tree on every local build, so a naive on-disk test would always pass; this one catches
  pure-metadata drift (e.g. a bumped `engineVersion`) that the corpus parity test misses. It skips
  in `cargo publish` / `cargo package` verify mode.

---

## License

Apache-2.0.
