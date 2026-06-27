# Changelog

All notable changes to **jsonstat-validator** are recorded here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). The package is **pre-1.0**: until
`1.0.0` the minor component may carry breaking changes; from `1.0.0` on, SemVer applies normally.

The error-code vocabulary is versioned **independently** of the package via `meta.ruleSetVersion`
(append-only within a major), so consumers branch on the vocabulary, not the package version. See
[`DESIGN.md §4.5`](DESIGN.md).

## [Unreleased]

Staged for the next release. Not yet published.

### Added
- `readme`, `keywords`, and `categories` metadata to the Rust crate manifest
  ([`crates/validator/Cargo.toml`](crates/validator/Cargo.toml)) so crates.io renders the README and
  surfaces the crate under discovery tags. (`0.3.0` shipped without a `readme`, so its crates.io page
  showed "no readme"; this takes effect from the next published version — published versions are
  immutable, so `0.3.0` itself cannot be retro-fixed.)

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

[Unreleased]: https://github.com/jsonstat/validator/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/jsonstat/validator/releases/tag/v0.3.0
[0.2.0]: https://github.com/jsonstat/validator/releases/tag/v0.2.0
