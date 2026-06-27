# `jsonstat-validate`

Command-line **semantic** validator for [JSON-stat](https://json-stat.org/) 2.0 — the CLI surface of the
[`jsonstat-validator`](https://github.com/jsonstat/validator) family. It runs the
[`@jsonstat-validator/ts`](https://www.npmjs.com/package/@jsonstat-validator/ts) engine under the hood: the
official JSON Schema 2020-12 structural pass plus the cross-field cube invariants JSON Schema cannot express.

> This CLI is one of four interchangeable surfaces (TS, Rust, Wasm, CLI) that all share **one**
> [`rules-manifest.json`](https://github.com/jsonstat/validator/blob/main/rules-manifest.json) and **one**
> [`corpus/cases.json`](https://github.com/jsonstat/validator/blob/main/corpus/cases.json), so they produce
> identical findings on identical input. See the [monorepo README](https://github.com/jsonstat/validator#readme)
> for the full architecture and [`DESIGN.md`](https://github.com/jsonstat/validator/blob/main/DESIGN.md) for the
> design rationale.

---

## Why

JSON Schema can validate *shape* (required properties, `oneOf`s, enums, the IANA link regex) but cannot express
relationships like "`value` array length must equal the product of `size`". `jsonstat-validate` runs exactly those
checks (the S/D/C catalogue) with a stable, versioned error-code vocabulary, and reports them in a CI-friendly
text or JSON format.

---

## Usage

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

### Or install globally

```bash
npm install -g jsonstat-validate
jsonstat-validate my-cube.json
```

---

## Options

```
jsonstat-validate <file|-> [options]
  --mode full|structural|semantic   validation phases to run (default: full)
  --format json|text                output format (default: text)
  --min-severity error|warning|info only show findings at/above this severity (default: info)
  --structural-only                 alias for --mode structural
  --semantic-only                   alias for --mode semantic
  -h, --help                        show usage
```

| Flag | Values | Default | Notes |
|---|---|---|---|
| `<file\|->` | path or `-` | — | A path to a JSON file, or `-` to read JSON from stdin |
| `--mode` | `full` \| `structural` \| `semantic` | `full` | Which passes to run |
| `--format` | `json` \| `text` | `text` | `json` emits the full `ValidationResult` for scripting |
| `--min-severity` | `error` \| `warning` \| `info` | `info` | Filters printed findings (does not affect the exit code) |
| `--structural-only` | — | — | Shorthand for `--mode structural` |
| `--semantic-only` | — | — | Shorthand for `--mode semantic` |

`--min-severity` only affects which findings are *displayed*; it never changes the exit code, which is `0` iff the
document has zero `error`-severity findings.

### JSON output

```bash
npx jsonstat-validate my-cube.json --format json
```

```jsonc
{
  "valid": false,
  "findings": [
    {
      "code": "VALUE_LEN_MISMATCH",
      "ruleId": "S3",
      "severity": "error",
      "path": "/value",
      "message": "Dense 'value' length 1 must equal product(size) = 2.",
      "expected": 2,
      "actual": 1,
      "specRef": "wiki/format-specification.md"
    }
  ],
  "summary": { "errors": 1, "warnings": 0, "infos": 0, "structuralErrors": 0, "byCode": { "VALUE_LEN_MISMATCH": 1 } },
  "meta": { "engineVersion": "0.3.0", "ruleSetVersion": "1.0.0", "schemaVersion": "1.05", "durationMs": 3 }
}
```

Structural (JSON Schema) violations are normalized into the **same** shape with `code: "STRUCTURAL_VIOLATION"` and
the offending keyword kept in `meta` — so tooling only ever handles one finding shape.

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
npm install                 # runs the `prepare` hook, which builds the CLI too
npx jsonstat-validate --help

# or, just this workspace
cd cli
npm run build               # sync-license → esbuild bundle of src/cli.ts → dist/cli.js
npm run dev                 # run directly from TypeScript: node --experimental-strip-types src/cli.ts
```

The CLI is a thin wrapper around [`@jsonstat-validator/ts`](https://www.npmjs.com/package/@jsonstat-validator/ts);
see [`src/cli.ts`](./src/cli.ts) for the argument parsing and output formatting.

---

## Related surfaces

- **TypeScript / Node** — [`@jsonstat-validator/ts`](https://www.npmjs.com/package/@jsonstat-validator/ts)
- **Rust** — [`jsonstat-validator`](https://crates.io/crates/jsonstat-validator) (`cargo add jsonstat-validator`)
- **Wasm** — 🚧 in progress (see the monorepo [Roadmap](https://github.com/jsonstat/validator#roadmap))

---

## License

Apache-2.0.
