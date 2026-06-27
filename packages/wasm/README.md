# `@jsonstat-validator/wasm`

The **WebAssembly** surface of [`jsonstat-validator`](../../README.md) — a thin JS wrapper over the
[Rust crate](../../crates/validator), exposing the **same `validate()` signature** as
[`@jsonstat-validator/ts`](../ts) so the two are drop-in compatible.

The Wasm build is produced from the crate with [`wasm-pack`](https://rustwasm.github.io/wasm-pack/)
(`--target web`); the wrapper in [`src/index.ts`](src/index.ts) adapts the `validate_json` export to
the TS `ValidationResult` shape.

> Built on top of the same [`rules-manifest.json`](../../rules-manifest.json) and
> [`corpus/cases.json`](../../corpus/cases.json) as the TS and Rust surfaces, so all three produce
> identical findings on identical input (enforced by the parity tests).

---

## Install

```bash
npm install @jsonstat-validator/wasm
```

## Usage

### Browser / CDN

`init()` (no argument) fetches the adjacent `.wasm` over HTTP:

```ts
import { init, validate } from "@jsonstat-validator/wasm";

await init();                       // load the .wasm once
const result = validate(doc);       // doc may be an object OR a JSON string
console.log(result.valid, result.summary);
```

With a bundler (Vite/webpack/Rollup) the `.wasm` is emitted next to the JS automatically.

### Node

The `@jsonstat-validator/wasm/node` entry auto-loads the `.wasm` bytes from disk on import, so no
manual `init()` is needed, and it adds `validateFile()`:

```ts
import { validate, validateFile } from "@jsonstat-validator/wasm/node";

const result = validate(doc);
const result2 = await validateFile("./my-cube.json");
```

(You can also use the main entry in Node by passing the bytes explicitly:
`await init(readFileSync(require.resolve("@jsonstat-validator/wasm/pkg/jsonstat_validator_bg.wasm")))`.)

---

## Differences from `@jsonstat-validator/ts`

| Concern | TS surface | Wasm surface |
|---|---|---|
| Lifecycle | none (pure JS) | `await init()` once (browser) / auto on Node |
| `options.onFinding` | supported (JS callback) | **ignored** (functions can't cross the JS↔wasm boundary) |
| `options.budget` | honored | **ignored** (Rust `ValidateOptions` skips unknown fields) |
| `meta.durationMs` | wall-clock ms (number) | always `0` — `wasm32-unknown-unknown` has no `Instant`, so timing is skipped |
| Finding shape (`code`/`severity`/`path`/`message`) | — | **identical** (parity-tested) |

If you don't need the Wasm performance characteristics or wasm-pack toolchain, prefer
`@jsonstat-validator/ts` — it has zero native/Rust dependencies.

---

## Building the Wasm artifact from source

```bash
# prerequisites (one-time)
rustup target add wasm32-unknown-unknown
cargo install wasm-pack

npm run build          # wasm-pack -t web -> packages/wasm/pkg, then tsc -> dist
npm test               # builds pkg and runs the TS↔Wasm corpus parity test
```

## License

Apache-2.0.
