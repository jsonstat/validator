# Changelog

All notable changes to **jsonstat-validator** are recorded here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). From `1.0.0` on, SemVer applies
normally; the full stability commitment (public API, diagnostic-result guarantees, error-code
vocabulary, deprecation policy) is in [`STABILITY.md`](STABILITY.md).

The error-code vocabulary is versioned **independently** of the package via `meta.ruleSetVersion`
(append-only within a major), so consumers branch on the vocabulary, not the package version. See
[`DESIGN.md §4.5`](DESIGN.md).

## [Unreleased]

Staged for the next release. Not yet published.

## [1.0.0] - 2026-07-01

The `1.0.0` cut. The work tracked in the README "Toward 1.0.0" section is complete; this release
makes the stability commitments in [`STABILITY.md`](STABILITY.md) — the public `validate()` surface,
the `ValidationResult` shape, and the error-code vocabulary are now stable.

### Added — curated schema architecture (DESIGN.md §2.3)
- A de-duplicated [`schemas/curated/`](schemas/curated/core.json) schema set: one shared
  [`core.json`](schemas/curated/core.json) holding all `$defs`, plus four thin per-class files
  (`dataset`, `collection`, `dimension`, `index`) that `$ref` into it — replacing the triplicated
  definitions the verbatim vendored originals carried.
- [`tools/bundle-schemas.mjs`](tools/bundle-schemas.mjs), which inlines every `$ref` into
  self-contained [`schemas/curated/bundled/`](schemas/curated/bundled) output. The TS
  ([`gen-assets.mjs`](packages/ts/tools/gen-assets.mjs)) and Rust
  ([`build.rs`](crates/validator/build.rs)) generators now embed the **bundled curated** set, not the
  vendored originals. Committed, with a bundler-determinism check in CI.
- The **curated≡vendored structural-parity gate**, proving the de-duplicated set is behaviorally
  identical to the verbatim upstream originals on every corpus case:
  [`packages/ts/test/curated-parity.test.ts`](packages/ts/test/curated-parity.test.ts) (identical
  outcomes + clean Unicode-RegExp compile + self-contained) and its Rust mirror
  [`crates/validator/tests/curated_equiv_vendored.rs`](crates/validator/tests/curated_equiv_vendored.rs).
- A dedicated **`curated-parity` CI job**
  ([`ci.yml`](.github/workflows/ci.yml)) that re-bundles and asserts the committed output is fresh,
  then runs the outcome-parity test — the guard against "edited the source, forgot to re-bundle".
- [`STABILITY.md`](STABILITY.md) — the SemVer / `ruleSetVersion` stability commitment artifact for the
  1.0.0 cut.
- `readme`, `keywords`, and `categories` metadata to the Rust crate manifest
  ([`crates/validator/Cargo.toml`](crates/validator/Cargo.toml)) so crates.io renders the README and
  surfaces the crate under discovery tags. (`0.3.0` shipped without a `readme`, so its crates.io page
  showed "no readme"; this takes effect from the next published version — published versions are
  immutable, so `0.3.0` itself cannot be retro-fixed.)

### Fixed
- The vendored `updated` date pattern carried an invalid `\-` RegExp escape (an escaped hyphen, which
  is a syntax error under the Unicode flag `u`). The curated set replaces it with a literal `-`,
  which matches the identical set of strings. This lets the structural pass compile cleanly under the
  default Unicode RegExp, removing the [`unicodeRegExp: false`](packages/ts/src/structural.ts)
  workaround in TS and the silent-skip-on-compile-failure fallback in
  [`structural.rs`](crates/validator/src/structural.rs) (now a `.expect()`, since the embedded
  schemas must compile).

### Changed
- Bumped the package version and `engineVersion` from `0.3.0` to **`1.0.0`** across every surface —
  [`@jsonstat-validator/ts`](packages/ts), the [`jsonstat-validate`](cli) CLI,
  [`@jsonstat-validator/wasm`](packages/wasm), and the [`jsonstat-validator`](crates/validator) Rust
  crate — plus the npm and Cargo lockfiles. `ruleSetVersion` stays `1.0.0` (no rule changes).
- [`@jsonstat-validator/wasm`](packages/wasm) now declares its `@jsonstat-validator/ts` dev dependency
  as `^1.0.0`.
- The Rust `_vendored` committed-snapshot drift guard
  ([`vendored_parity.rs`](crates/validator/tests/vendored_parity.rs)) now asserts the snapshot matches
  the **curated/bundled** sources (its actual input), not the vendored originals.
- Rewrote the README "Status" / "Versioning" sections for the 1.0.0 cut; retired the now-complete
  "Toward 1.0.0" section.

## [0.3.0] - 2026-06-27

`0.3.0` was chosen over `1.0.0` on purpose — see the README "Status" section: the
`schemas/curated/` schema architecture is still pending, so the `1.0.0` stability commitments (a
written SemVer / `ruleSetVersion` policy, this changelog as the artifact) are deferred to a
follow-up release.

### Added
- A `publish-crate` job in [`release.yml`](.github/workflows/release.yml) that publishes the
  [`jsonstat-validator`](crates/validator) Rust crate to crates.io. crates.io has no OIDC trusted
  publishing like npm, so the job is gated behind a `crates-io` environment with a
  `CARGO_REGISTRY_TOKEN` secret.
- Node 18 to the TypeScript CI matrix ([`ci.yml`](.github/workflows/ci.yml)), matching the
  documented Node 18/20/22 target in [`DESIGN.md §8.1`](DESIGN.md).

### Changed
- Bumped the package version and `engineVersion` from `0.2.0` to **`0.3.0`** across every surface —
  [`@jsonstat-validator/ts`](packages/ts), the [`jsonstat-validate`](cli) CLI,
  [`@jsonstat-validator/wasm`](packages/wasm), and the [`jsonstat-validator`](crates/validator) Rust
  crate — plus the npm and Cargo lockfiles. `ruleSetVersion` stays `1.0.0` (no rule changes).
- [`@jsonstat-validator/wasm`](packages/wasm) now declares its `@jsonstat-validator/ts` dev dependency
  as `^0.3.0`.
- Retired the README "Roadmap" section into a forward-looking "Status" section. The M1–M5 milestone
  history now lives here and in [`DESIGN.md §11`](DESIGN.md).

## [0.2.0]

- First **Wasm** surface: the Rust crate compiles to WebAssembly (`wasm-pack --target web`), exposed
  through the [`@jsonstat-validator/wasm`](packages/wasm) JS wrapper with the same `validate()` shape
  as the TypeScript package.
- Added the TS↔Wasm corpus parity test in CI, closing the TS ↔ Rust ↔ Wasm parity triangle. (The
  port surfaced two crate fixes: `std::time::Instant` panics on `wasm32-unknown-unknown` and is
  replaced by a no-op `Timer` on that target; `console_error_panic_hook` is installed so panics
  surface as readable console messages.)
- Added the Rust `_vendored` committed-snapshot parity guard
  ([`crates/validator/tests/vendored_parity.rs`](crates/validator/tests/vendored_parity.rs)), which
  catches pure-metadata drift the corpus test misses.
- Added npm publish-on-release via GitHub Actions using npm Trusted Publishing (OpenID Connect).

## Earlier (0.1.x)

Initial TypeScript engine, full S/D/C rule set, shared corpus, and the CLI (M1/M2), and the Rust
port with corpus parity (M3). See the git history for details.

[Unreleased]: https://github.com/jsonstat/validator/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/jsonstat/validator/releases/tag/v1.0.0
[0.3.0]: https://github.com/jsonstat/validator/releases/tag/v0.3.0
[0.2.0]: https://github.com/jsonstat/validator/releases/tag/v0.2.0
