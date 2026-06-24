// Public entrypoint for @jsonstat-validator/ts.
export { validate, validateFile } from "./pipeline.js";
export { MANIFEST, lookupRule } from "./manifest.js";
export { analyzeDataset, runSemantic } from "./engine.js";
export { validateStructural } from "./structural.js";
export { RULES } from "./rules/index.js";
export type {
  Finding, ValidationResult, ValidateOptions, Summary, ResultMeta,
  Severity, ValidationMode, ManifestData, ManifestRule, ResolvedOptions,
} from "./types.js";
