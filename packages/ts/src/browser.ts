// Browser / CDN entrypoint. Mirrors src/index.ts MINUS validateFile(), which needs node:fs and so
// cannot run in a browser. Bundled by tools/build-browser.mjs into a self-contained IIFE/ESM file
// for <script src> and CDN consumers (esm.sh / jsDelivr / unpkg).
export { validate } from "./pipeline.js";
export { MANIFEST, lookupRule } from "./manifest.js";
export { analyzeDataset, runSemantic } from "./engine.js";
export { validateStructural } from "./structural.js";
export { RULES } from "./rules/index.js";
export type {
  Finding, ValidationResult, ValidateOptions, Summary, ResultMeta,
  Severity, ValidationMode, ManifestData, ManifestRule, ResolvedOptions,
} from "./types.js";
