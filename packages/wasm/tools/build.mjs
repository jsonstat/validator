// Builds the WebAssembly surface of @jsonstat-validator/wasm: runs wasm-pack against the Rust
// crate (crates/validator) with the `wasm` feature, emitting a --target web ESM bundle + the
// .wasm binary into packages/wasm/pkg. The thin TS wrapper in src/ imports that output and is
// compiled to dist/ by `tsc` (see the `build` script).
//
// Prerequisites (not installed automatically): `wasm-pack` (`cargo install wasm-pack`) and the
// `wasm32-unknown-unknown` standard library target (`rustup target add wasm32-unknown-unknown`).
//
// The RUSTFLAGS getrandom_backend="wasm_js" cfg is required by the getrandom dependency on
// wasm32 (see crates/validator/Cargo.toml).
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, "..");
const repoRoot = path.resolve(pkgRoot, "..", "..");
const crateRoot = path.join(repoRoot, "crates", "validator");
const outDir = path.join(pkgRoot, "pkg");

console.log(`build:wasm: wasm-pack -> ${path.relative(repoRoot, outDir)}`);
execSync(
  `wasm-pack build --release -t web "${crateRoot}" --out-dir "${outDir}" --out-name jsonstat_validator`,
  {
    stdio: "inherit",
    env: { ...process.env, RUSTFLAGS: '--cfg getrandom_backend="wasm_js"' },
  },
);
console.log("build:wasm: done");
