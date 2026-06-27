# `@jsonstat-validator/ts`

A **semantic** validator for [JSON-stat](https://json-stat.org/) 2.0 — the native TypeScript/Node surface of the
[`jsonstat-validator`](https://github.com/jsonstat/validator) family. It **reuses** the official JSON Schema
2020-12 definitions for the *structural* pass and layers on top a rules engine that checks the cross-field cube
invariants JSON Schema cannot express.

> This package is one of four interchangeable surfaces (TS, Rust, Wasm, CLI) that all share **one**
> [`rules-manifest.json`](https://github.com/jsonstat/validator/blob/main/rules-manifest.json) and **one**
> [`corpus/cases.json`](https://github.com/jsonstat/validator/blob/main/corpus/cases.json), so they produce
> identical findings on identical input. See the [monorepo README](https://github.com/jsonstat/validator#readme)
> for the full architecture and [`DESIGN.md`](https://github.com/jsonstat/validator/blob/main/DESIGN.md) for the
> design rationale.

---

## Why

JSON Schema can validate *shape* (required properties, `oneOf`s, enums, the IANA link regex) but cannot express
relationships like "`value` array length must equal the product of `size`". This package implements exactly those
checks (the S/D/C catalogue) with a stable, versioned error-code vocabulary.

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

A schema engine says "this is shaped like a dataset". `@jsonstat-validator/ts` tells you the actual problem:
`value` has 5 entries but `product(size)` is `2 × 3 = 6` — see [`VALUE_LEN_MISMATCH`](#error-codes).

---

## Install

```bash
npm install @jsonstat-validator/ts
```

Works in Node (ESM + CJS) and the browser. Runtime dependencies are limited to [`ajv`](https://www.npmjs.com/package/ajv)
and [`ajv-formats`](https://www.npmjs.com/package/ajv-formats); the package is `sideEffects: false` so it tree-shakes.

---

## Quick start

```ts
import { validate } from "@jsonstat-validator/ts";

const result = validate(doc);          // doc may be an object OR a JSON string
console.log(result.valid);             // true / false
console.log(result.summary);           // { errors, warnings, infos, structuralErrors, byCode }
for (const f of result.findings) {     // Finding[] — empty when valid
  console.log(`[${f.severity}] ${f.code}  ${f.path}  — ${f.message}`);
}
```

`validate()` accepts a parsed object **or** a raw JSON string (it parses for you). To validate a file on disk, use
the async [`validateFile()`](./src/pipeline.ts):

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

Structural (JSON Schema) violations are normalized into the **same** shape with `code: "STRUCTURAL_VIOLATION"` and
the offending keyword kept in `meta` — so consumers only ever handle one finding shape.

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

`minSeverity` filters which findings are **returned**; it never affects the `valid` flag, which is `true` iff there
are zero `error`-severity findings.

---

## Web / CDN

The package is dependency-light and browser-safe, so you can use it straight from a CDN with no build step. Works on
[esm.sh](https://esm.sh/), [jsDelivr](https://www.jsdelivr.com/), and [unpkg](https://unpkg.com/).

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

> The browser build excludes [`validateFile()`](./src/browser.ts) (it needs `node:fs`). Use `validate()` in the
> browser and fetch the document yourself.

### Bundled in an app (Vite, webpack, Rollup, …)

```bash
npm install @jsonstat-validator/ts
```

```ts
import { validate } from "@jsonstat-validator/ts";
```

The package's `exports` map points bundlers at the browser build automatically, so the same import works in Node and
the browser with no special config.

---

## API

### `validate(doc, options?) → ValidationResult`

Run the structural (JSON Schema) + semantic (S/D/C rules) passes. `doc` may be a parsed object or a JSON string.

### `validateFile(path, options?) → Promise<ValidationResult>`

Read a file from disk and validate it. Enforces the `budget.maxBytes` guard before reading. **Node only** — not
available in the browser build.

### `ValidateOptions`

| Option | Type | Default | Notes |
|---|---|---|---|
| `mode` | `"full" \| "structural" \| "semantic"` | `"full"` | Which passes to run |
| `minSeverity` | `"error" \| "warning" \| "info"` | `"info"` | Filters returned findings (does not affect `valid`) |
| `maxCollectionDepth` | `number` | `3` | Max depth of embedded-collection recursion; `0` disables |
| `budget` | `{ maxCells?, maxBytes?, maxFindings? }` | `{ 50_000_000, 200 MB, 1000 }` | Hard limits to prevent OOM |
| `continueOnStructuralError` | `boolean` | `true` | Run semantic rules in degraded mode when shape is broken |
| `onFinding` | `(f: Finding) => void` | — | Streaming sink, invoked once per finding in addition to the returned array |

Full type definitions ship in `dist/index.d.ts`.

---

## Error codes

See [`rules-manifest.json`](https://github.com/jsonstat/validator/blob/main/rules-manifest.json) for the
authoritative, append-only catalogue. Codes include `VALUE_LEN_MISMATCH`, `SPARSE_KEY_OUT_OF_RANGE`,
`STATUS_LEN_MISMATCH`, `DIM_KEY_ID_MISMATCH`, `ID_SIZE_LEN_MISMATCH`, `ROLE_ID_UNKNOWN`,
`INDEX_COUNT_MISMATCH`, `INDEX_POSITIONS_INVALID`, `LABEL_KEY_UNKNOWN`, `LABEL_KEY_INCOMPLETE`,
`UNIT_KEY_UNKNOWN`, `COORD_KEY_UNKNOWN`, `NOTE_KEY_UNKNOWN`, `CHILD_ID_UNKNOWN`, `CHILD_CYCLE`,
`METRIC_UNIT_MISSING` (warning), `BUNDLE_DEPRECATED` (info), `RECURSION_LIMIT` (info), `CUBE_SIZE_OVERFLOW`,
`BUDGET_EXCEEDED` (warning), `PARSE_ERROR`, and `STRUCTURAL_VIOLATION`. The vocabulary is versioned independently
(`meta.ruleSetVersion`) from the package SemVer.

---

## Building from source

```bash
# from the monorepo root
npm install                 # runs the `prepare` hook, which builds all workspaces
npm test                    # corpus + rule tests

# or, just this package
cd packages/ts
npm run build               # sync-license → gen assets → tsc → cjs + browser bundles
```

[`tools/gen-assets.mjs`](./tools/gen-assets.mjs) compiles the shared manifest and vendored schemas into
`src/generated/` TypeScript modules at build time, so the published tarball is self-contained (no disk reads at
runtime). [`tools/build-browser.mjs`](./tools/build-browser.mjs) uses
[esbuild](https://esbuild.github.io/) to emit the IIFE + ESM browser bundles under `dist/browser/`.

---

## Related surfaces

- **CLI** — [`jsonstat-validate`](https://www.npmjs.com/package/jsonstat-validate) (`npx jsonstat-validate`)
- **Rust** — [`jsonstat-validator`](https://crates.io/crates/jsonstat-validator) (`cargo add jsonstat-validator`)
- **Wasm** — 🚧 in progress (see the monorepo [Roadmap](https://github.com/jsonstat/validator#roadmap))

---

## License

Apache-2.0.
