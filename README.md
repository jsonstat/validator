# jsonstat-validator

A **semantic** validator for [JSON-stat](https://json-stat.org/) 2.0. It **reuses** the official JSON
Schema 2020-12 definitions for the *structural* pass and layers on top a rules engine that checks the
cross-field cube invariants JSON Schema cannot express.

> Designed in [DESIGN.md](./DESIGN.md).
> Architectural companion to the [LLM-Wiki](https://github.com/jsonstat/llm-wiki) JSON-stat knowledge base.

## Why

JSON Schema can validate *shape* (required properties, `oneOf`s, enums, the IANA link regex) but
cannot express relationships like "`value` array length must equal the product of `size`". This
package implements exactly those checks (the S/D/C catalogue) with a stable, versioned error-code
vocabulary.

## Surfaces

| Surface | Package | Status |
|---|---|---|
| TypeScript | `packages/ts` (`@jsonstat-validator/ts`) | ✅ M1/M2 — 27/27 tests pass, CLI works, `tsc` build clean |
| Rust | `crates/validator` (`jsonstat-validator`) | ✅ M3 — compiles, corpus parity test passes |
| Wasm | `crates/validator` (`--features wasm`) | 🚧 M4 — `wasm.rs` written, gated behind the `wasm` feature |
| CLI | `cli/` (`jsonstat-validate`) | ✅ Node CLI |

The two runtimes share **one** [`rules-manifest.json`](rules-manifest.json) (loaded verbatim by both)
and **one** [`corpus/cases.json`](corpus/cases.json); the Rust test suite asserts the same
expectations as the TS suite — this is the behavioural parity gate.

## Quick start (TypeScript)

```bash
cd packages/ts && npm install && npm test
```

Validate a document:

```ts
import { validate } from "@jsonstat-validator/ts";
const result = validate(doc);          // { valid, findings, summary, meta }
console.log(result.valid, result.summary);
```

CLI:

```bash
echo '{"version":"2.0","class":"dataset","id":["x"],"size":[2],"dimension":{"x":{"category":{"index":["a","b"]}}},"value":[1]}' \
  | node --loader ./tools/ts-loader.mjs ../../cli/src/cli.ts -
```

## Quick start (Rust)

```bash
cd crates/validator && cargo test            # corpus parity
echo '{"version":"2.0","class":"dataset","id":["x"],"size":[2],"dimension":{"x":{"category":{"index":["a","b"]}}},"value":[1]}' \
  | cargo run --example validate -- -
```

```rust
use jsonstat_validator::{validate_from_str, ValidateOptions};
let result = validate_from_str(json, &ValidateOptions::default());
```

## Error codes

See [`rules-manifest.json`](rules-manifest.json) for the authoritative, append-only catalogue. Codes
include `VALUE_LEN_MISMATCH`, `SPARSE_KEY_OUT_OF_RANGE`, `STATUS_LEN_MISMATCH`, `DIM_KEY_ID_MISMATCH`,
`ID_SIZE_LEN_MISMATCH`, `ROLE_ID_UNKNOWN`, `INDEX_COUNT_MISMATCH`, `INDEX_POSITIONS_INVALID`,
`LABEL_KEY_UNKNOWN`, `UNIT_KEY_UNKNOWN`, `COORD_KEY_UNKNOWN`, `NOTE_KEY_UNKNOWN`, `CHILD_ID_UNKNOWN`,
`CHILD_CYCLE`, `METRIC_UNIT_MISSING` (warning), `BUNDLE_DEPRECATED` (info), `CUBE_SIZE_OVERFLOW`,
`PARSE_ERROR`, and `STRUCTURAL_VIOLATION`. The vocabulary is versioned independently
(`meta.ruleSetVersion`) from the package SemVer.

## Roadmap

- **M1/M2** ✅ TypeScript engine, full rule set, corpus, CLI.
- **M3** ✅ Rust port + corpus parity.
- **M4** ✅ Wasm surface compiles (`cargo build --features wasm --target wasm32-unknown-unknown` with `RUSTFLAGS='--cfg getrandom_backend="wasm_js"'`); JS wrapper + cross-validation still pending.
- **M5** ⏳ npm + crates.io publish, `curated/` de-duplicated schemas (with curated≡vendored parity
  test), full CI/release.

## License

Apache-2.0, matching the rest of the JSON-stat ecosystem.
