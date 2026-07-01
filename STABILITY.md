# Stability & versioning policy

> **Status:** Active, as of the `1.0.0` release. This document is the stability commitment the
> `1.0.0` cut makes — it is normative for every subsequent release until superseded by a new major.

The `jsonstat-validator` project is multi-surface: a TypeScript package
(`@jsonstat-validator/ts`), a CLI (`jsonstat-validate`), a Rust crate (`jsonstat-validator`), and a
Wasm binding (`@jsonstat-validator/wasm`). All four are governed by the policies below. They are kept
**in lock-step on every release**: a single version number moves across all of them (see
[Releases](#releases)).

---

## 1. What "stable" means at 1.0.0

Reaching `1.0.0` makes two commitments:

1. **Public API stability.** The shapes documented in [`DESIGN.md`](DESIGN.md) §5 — `validate()`,
   `validateFile()`, `ValidateOptions`, `ValidationResult`, `Finding`, `Summary` — are stable. Code
   written against the 1.0.0 API will keep compiling and producing the same results through all
   `1.x` releases.
2. **Vocabulary stability.** The set of error codes the validator can emit, their identifiers, and
   their meaning are stable and independently versioned by `ruleSetVersion` (see
   [§3](#3-rulesetversion--error-code-vocabulary)). Downstream tooling may branch on a code's
   presence without fear of a silent rename.

These are *separate* commitments on *separate* clocks: an API patch need not (and will not) touch
the error-code vocabulary, and a vocabulary change need not break the API.

---

## 2. The three version axes

Every validation result carries a `meta` block with three independent version fields. None of them
imply anything about the others:

| Field | What it tracks | Source of truth | Bumps when… |
|---|---|---|---|
| `engineVersion` | the validator **software** itself | [`rules-manifest.json`](rules-manifest.json) `engineVersion`, mirrored from the package version at release | any release of the npm packages / crates.io crate / CLI / Wasm binding |
| `ruleSetVersion` | the **error-code vocabulary** — which codes exist, their severities, and their message semantics | [`rules-manifest.json`](rules-manifest.json) `ruleSetVersion` | a code is added/removed, or a severity/message changes (see [§3](#3-rulesetversion--error-code-vocabulary)) |
| `schemaVersion` | the **JSON-stat format** the validator checks against | [`rules-manifest.json`](rules-manifest.json) `schemaVersion` | the upstream JSON-stat spec revision the validator targets changes |

`engineVersion` is the field consumers should treat as "the library version." `ruleSetVersion` is
the field consumers should branch on when they care about *which diagnostics can appear*.
`schemaVersion` is informational — it records that the validator implements the checks mandated by
that revision of the JSON-stat format.

---

## 3. `ruleSetVersion` — error-code vocabulary

The rule catalogue lives in [`rules-manifest.json`](rules-manifest.json) and is the single source of
truth loaded verbatim by every surface (TS via `fs`, Rust via `include_str!`). It carries its own
SemVer, **independent of the package version.** At `1.0.0` the `ruleSetVersion` is `1.0.0`.

### 3.1 The codes (frozen as of ruleSetVersion 1.0.0)

These identifiers are permanent. A code is never renamed; if a check is retired its code is
[retired, not recycled](#33-removing-a-code--major-bump).

| Code | Severity | Applies to |
|---|---|---|
| `ID_SIZE_LEN_MISMATCH` | error | dataset |
| `DIM_KEY_ID_MISMATCH` | error | dataset |
| `VALUE_LEN_MISMATCH` | error | dataset |
| `SPARSE_KEY_OUT_OF_RANGE` | error | dataset |
| `ROLE_ID_UNKNOWN` | error | dataset |
| `STATUS_LEN_MISMATCH` | error | dataset |
| `STATUS_KEY_OUT_OF_RANGE` | error | dataset |
| `METRIC_UNIT_MISSING` | warning | dataset |
| `INDEX_COUNT_MISMATCH` | error | dimension |
| `INDEX_POSITIONS_INVALID` | error | dimension |
| `LABEL_KEY_UNKNOWN` | error | dimension |
| `LABEL_KEY_INCOMPLETE` | warning | dimension |
| `UNIT_KEY_UNKNOWN` | error | dimension |
| `COORD_KEY_UNKNOWN` | error | dimension |
| `NOTE_KEY_UNKNOWN` | error | dimension |
| `CHILD_ID_UNKNOWN` | error | dimension |
| `CHILD_CYCLE` | error | dimension |
| `RECURSION_LIMIT` | info | collection |
| `BUNDLE_DEPRECATED` | info | dataset |
| `CUBE_SIZE_OVERFLOW` | error | dataset |
| `PARSE_ERROR` | error | any |
| `STRUCTURAL_VIOLATION` | error | any |
| `BUDGET_EXCEEDED` | warning | any |

### 3.2 Stability contract (within a `ruleSetVersion` major)

Within the same `ruleSetVersion` **major** (i.e. any `1.x`):

- **Codes are append-only.** A code present in `1.0.0` is present in every subsequent `1.x`.
- **Severity may only tighten, never loosen, and only in a minor bump.** Specifically:
  - `info` → `warning` or `warning` → `error` is a **minor** bump (e.g. `1.0.0` → `1.1.0`), and is
    recorded in [`CHANGELOG.md`](CHANGELOG.md).
  - `error` → `warning` (loosening) is **not allowed** within a major; it requires a **major** bump.
- **Message text and `path` may be refined in a patch** as long as the *meaning* is unchanged
  (typos, clarity). A change to what a code *detects* is a **minor** bump at minimum.
- **`ruleId`, `specRef`, and `appliesTo`** are part of the contract. Changing which document class a
  code applies to is a **minor** bump.

### 3.3 Removing a code → major bump

Retiring or removing a code is a **major** `ruleSetVersion` bump (e.g. `1.x` → `2.0.0`). Removal is
reserved for codes that are fundamentally wrong or unattainable; preference is to *supersede* (add a
new code, document the old one as deprecated) rather than remove. A removed code's identifier is
**never reused** for a different meaning.

### 3.4 Why a separate axis

Consumers gate CI, lint rules, and dashboards on specific codes. Tying the vocabulary to the package
version would mean every API patch (a new option, a bug fix) would invalidate those gates. By giving
the vocabulary its own SemVer, a consumer can pin `ruleSetVersion ^1.0.0` and be assured that no
code they branch on will vanish or silently change severity across any number of engine releases.

---

## 4. Package SemVer (`engineVersion`)

The npm packages, the crates.io crate, the CLI, and the Wasm binding all share one version number,
reported as `engineVersion` in results. It follows ordinary SemVer:

| Change | Bump |
|---|---|
| Breaking change to a public type, function signature, option name/semantics, or documented behavior | **major** |
| New option, new public function, new `Finding` field, or a backward-compatible behavior change | **minor** |
| Bug fix that does not alter documented behavior | **patch** |

### 4.1 What counts as "public API"

The stable surface is exactly what [`DESIGN.md`](DESIGN.md) §5 documents:

- `validate(doc, options?)` / `validateFile(path, options?)` and their result type `ValidationResult`.
- `ValidateOptions` (field names, defaults, and documented semantics).
- `Finding`, `Summary`, and the `meta` block (including the three version fields above).
- The CLI's flags, exit-code contract (`0` iff `valid === true`), and output JSON shape.

The following are **not** covered by the stability promise and may change without a major bump:

- The internal module layout of the published packages (anything not re-exported from the package
  entry point).
- The exact wording of human-readable `message` strings (the *code* is stable; the prose is not —
  localize/format it yourself for end users).
- The exact set of paths emitted for a given violation across versions (instance paths are
  best-effort and may be refined; the *code* is the stable identifier).
- The bundled `.wasm` internals and JS glue (only the `validate`/`init` entry is stable).

### 4.2 Diagnostic-result stability

`result.valid` (the boolean) is the single most stable output: a document that is `valid: true`
under `1.0.0` will remain `valid: true` under all `1.x` (barring a **bug fix** to a check that was
wrongly passing invalid input — which counts as a patch but is called out in the changelog). A
document that is `valid: false` may gain *additional* findings in a minor/patch (a new code can be
added; an existing check can grow coverage), but its `valid: false` verdict will not flip to `true`.

---

## 5. Schema versioning (curated vs vendored)

The structural pass validates against the JSON-stat 2.0 JSON Schema (2020-12 draft). As of `1.0.0`
the validator loads a **curated, de-duplicated** schema set rather than the verbatim upstream:

- [`schemas/curated/`](schemas/curated/core.json) — the authored sources: one shared
  [`core.json`](schemas/curated/core.json) holding all `$defs`, plus four thin per-class files
  (`dataset`, `collection`, `dimension`, `index`) that `$ref` into it.
- [`schemas/curated/bundled/`](schemas/curated/bundled/dataset.json) — the **self-contained** output
  of [`tools/bundle-schemas.mjs`](tools/bundle-schemas.mjs), which inlines every `$ref`. This is what
  the generators ([`gen-assets.mjs`](packages/ts/tools/gen-assets.mjs) for TS,
  [`build.rs`](crates/validator/build.rs) for Rust) embed. Committed.
- [`schemas/vendored/`](schemas/vendored/dataset.json) — the **verbatim** upstream originals, kept
  untouched as the provenance/quote source. They are *not* loaded at runtime.

**Why two sets:** the vendored originals are the authoritative quote of the upstream schema; the
curated set is the de-duplicated, maintainable form the validator ships. A CI
**curated≡vendored parity** test (see [`packages/ts/test/curated-parity.test.ts`](packages/ts/test/curated-parity.test.ts)
and [`crates/validator/tests/curated_equiv_vendored.rs`](crates/validator/tests/curated_equiv_vendored.rs))
proves the two produce identical structural outcomes on every corpus case, so the de-duplication is
behavior-preserving.

**The one intentional divergence:** the vendored `updated` pattern carries an invalid `\-` RegExp
escape that breaks under the Unicode flag (`u`). The curated set replaces it with a literal `-`. This
is strictly a bug fix — the pattern matches the identical set of strings — and it is what lets the
structural pass compile cleanly with no `unicodeRegExp: false` workaround (TS) or silent-skip
fallback (Rust).

`schemaVersion` (currently `1.05`) reflects the JSON-stat format revision these schemas implement; it
moves only when the validator's *target spec* changes, independently of the package version.

---

## 6. Deprecation policy

- A public API element slated for removal is first **deprecated** in a **minor** release (JSDoc/
  rustdoc `@deprecated`, noted in [`CHANGELOG.md`](CHANGELOG.md)) and continues to work.
- It is removed only in the next **major**, after at least one full minor cycle of deprecation.
- Deprecated behavior is not a stability violation: relying on it is at the consumer's risk.

For the error-code vocabulary, the analog is [supersession](#33-removing-a-code--major-bump): a code
is documented as deprecated and a replacement is recommended, but the old code continues to emit
until a `ruleSetVersion` major.

---

## 7. Releases

- **One version, all surfaces.** Each release moves a single SemVer number across the npm packages,
  the crates.io crate, the CLI, and the Wasm binding; that number is written to
  `engineVersion` in [`rules-manifest.json`](rules-manifest.json) in the same commit.
- **`ruleSetVersion` moves independently**, only when the vocabulary changes, and is recorded in the
  same [`CHANGELOG.md`](CHANGELOG.md) entry under a clearly labeled sub-section.
- **Tags.** Releases are cut from signed git tags (`v1.0.0`, …). npm uses Trusted Publishing (OIDC);
  crates.io uses a `CARGO_REGISTRY_TOKEN` under the `crates-io` environment.
- **Changelog.** Every release documents API changes *and* any rule-set changes. A machine-readable
  `rules-changelog` records per-code additions/severity changes for tooling that tracks the
  vocabulary.
- **Drift guards.** CI enforces that the committed embedded snapshots stay byte-identical to their
  sources — the curated-parity job (bundler determinism + outcome parity) and the Rust snapshot drift
  test ([`vendored_parity.rs`](crates/validator/tests/vendored_parity.rs)) both must be green before
  a release ships.

---

## 8. In short

- **Upgrading within `1.x` is safe.** Same API, same codes; you may gain findings, never lose a code.
- **Branch on `meta.ruleSetVersion`**, not on `engineVersion`, when you care about which codes exist.
- **The boolean `valid` is the most stable signal.** A `true` stays `true`; a `false` stays `false`.
- **Codes are permanent.** They are appended, optionally tightened, and only ever removed in a
  vocabulary major — and never reused.
