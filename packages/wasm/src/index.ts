// @jsonstat-validator/wasm — thin JS wrapper over the Rust crate's WebAssembly surface.
//
// Same `validate(doc, options)` signature as @jsonstat-validator/ts, so consumers can swap the two
// implementations without touching call sites. The single difference is the lifecycle: the .wasm
// module must be instantiated once before validation, via `await init()` (browser/CDN) or the
// auto-loading `@jsonstat-validator/wasm/node` entry (Node).
import wasmInit, { validate_json } from "../pkg/jsonstat_validator.js";
import type { ValidateOptions, ValidationResult } from "@jsonstat-validator/ts";

let initialized = false;

/**
 * Instantiate the WebAssembly module exactly once.
 *
 * - Browser / CDN: call with **no argument**. The bundler or browser resolves the adjacent
 *   `jsonstat_validator_bg.wasm` (via `import.meta.url`) and fetches it.
 * - Node: pass the raw wasm bytes, e.g. `await init(readFileSync(pathToWasm))`. (The
 *   `@jsonstat-validator/wasm/node` entry does this for you.)
 */
export async function init(
  moduleOrPath?: ArrayBuffer | Uint8Array | WebAssembly.Module | string | URL,
): Promise<void> {
  if (!initialized) {
    await wasmInit(moduleOrPath as Parameters<typeof wasmInit>[0]);
    initialized = true;
  }
}

/**
 * Validate a parsed JSON-stat document (or a raw JSON string). Mirrors
 * `@jsonstat-validator/ts`'s `validate()` and returns the same `ValidationResult` shape.
 *
 * Note: `options.onFinding` (a JS function) cannot cross the JS↔wasm boundary and is ignored on
 * this surface; `options.budget` is also ignored (the Rust `ValidateOptions` skips unknown fields).
 */
export function validate(doc: unknown, options?: ValidateOptions): ValidationResult {
  if (!initialized) {
    throw new Error("@jsonstat-validator/wasm: call `await init()` once before validate().");
  }
  // Strip the function-valued option so it never reaches the serde boundary.
  const serializable = { ...(options ?? {}) } as Record<string, unknown>;
  delete serializable.onFinding;
  return validate_json(doc, serializable) as ValidationResult;
}

export type {
  ValidateOptions,
  ValidationResult,
  Finding,
  Severity,
  Summary,
} from "@jsonstat-validator/ts";
