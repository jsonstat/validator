// Node entrypoint. Auto-loads the .wasm bytes from disk on import (so no manual `await init()` is
// needed) and adds `validateFile()`, which reads a path via node:fs — mirroring the TS surface's
// Node convenience so the two packages are drop-in compatible in Node.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { init, validate } from "./index.js";
import type { ValidateOptions, ValidationResult } from "@jsonstat-validator/ts";

// The wasm-pack --target web output sits next to this file (one level up from src/, or from dist/
// in the built package). Feed its bytes to init() — the web `init()` accepts a BufferSource on Node.
const wasmPath = fileURLToPath(
  new URL("../pkg/jsonstat_validator_bg.wasm", import.meta.url),
);
await init(readFileSync(wasmPath));

export { validate, init };

/** Validate a JSON-stat document loaded from a file path. Mirrors @jsonstat-validator/ts. */
export async function validateFile(
  path: string,
  options?: ValidateOptions,
): Promise<ValidationResult> {
  const doc = JSON.parse(readFileSync(path, "utf8"));
  return validate(doc, options);
}
