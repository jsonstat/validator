// Public types for @jsonstat-validator/ts.
// Mirrors the design (plans/jsonstat-validator-design.md §4, §5).

export type Severity = "error" | "warning" | "info";
export type AppliesTo = "dataset" | "dimension" | "collection" | "any";

export interface ManifestRule {
  id: string;
  code: string;
  severity: Severity;
  appliesTo: AppliesTo;
  specRef: string;
  message: string;
}

export interface ManifestData {
  engineVersion: string;
  ruleSetVersion: string;
  schemaVersion: string;
  description?: string;
  rules: ManifestRule[];
}

export interface Finding {
  /** Stable, versioned error code (see manifest). */
  code: string;
  /** Rule id in the catalogue, e.g. "S3". */
  ruleId: string;
  severity: Severity;
  /** RFC 6901 JSON pointer to the offending location. */
  path: string;
  message: string;
  expected?: unknown;
  actual?: unknown;
  specRef: string;
  /** Reserved for STRUCTURAL_VIOLATION (keyword) and other metadata. */
  meta?: Record<string, unknown>;
}

export interface Summary {
  errors: number;
  warnings: number;
  infos: number;
  structuralErrors: number;
  byCode: Record<string, number>;
  truncated?: number;
}

export type ValidationMode = "full" | "structural" | "semantic";

export interface ValidateOptions {
  /** Which passes to run. Default "full". */
  mode?: ValidationMode;
  /** Filters RETURNED findings (does not affect `valid`). Default "info" (all). */
  minSeverity?: Severity;
  /** Max depth of embedded-collection recursion. Default 3; 0 disables. */
  maxCollectionDepth?: number;
  /** Hard limits to prevent OOM on hostile/large input. */
  budget?: { maxCells?: number; maxBytes?: number; maxFindings?: number };
  /** When the structural pass fails, run semantic rules in degraded mode (no-op on missing shapes). Default true. */
  continueOnStructuralError?: boolean;
  /** Streaming sink: invoked once per finding, in addition to the returned array. */
  onFinding?: (f: Finding) => void;
}

export interface ResolvedBudget {
  maxCells: number;
  maxBytes: number;
  maxFindings: number;
}

export interface ResolvedOptions {
  mode: ValidationMode;
  minSeverity: Severity;
  maxCollectionDepth: number;
  continueOnStructuralError: boolean;
  budget: ResolvedBudget;
  onFinding?: (f: Finding) => void;
}

export interface ResultMeta {
  engineVersion: string;
  ruleSetVersion: string;
  schemaVersion: string;
  durationMs: number;
}

export interface ValidationResult {
  /** True iff there are zero error-severity findings (independent of minSeverity filtering). */
  valid: boolean;
  findings: Finding[];
  summary: Summary;
  options: ResolvedOptions;
  meta: ResultMeta;
}

// --- Internal engine types ---

export type RuleKind = "dataset" | "dimension";

/** Immutable-ish bundle handed to each rule. `finding()` looks the code up in the manifest and emits. */
export interface Ctx {
  doc: any;
  rootPointer: string;
  product: bigint | null;
  productOverflow: boolean;
  idArr: string[] | null;
  sizeArr: number[] | null;
  idSet: Set<string> | null;
  opts: ResolvedOptions;
  manifest: ManifestData;
  finding: (
    ruleId: string,
    partial: {
      path: string;
      message: string;
      expected?: unknown;
      actual?: unknown;
      meta?: Record<string, unknown>;
    },
  ) => void;
}

export interface DatasetRule {
  kind: "dataset";
  id: string;
  check: (c: Ctx) => void;
}

export interface DimensionRule {
  kind: "dimension";
  id: string;
  // size may be null when sizeArr is unusable (degraded mode).
  check: (c: Ctx, dimId: string, dim: any, size: number | null) => void;
}

export type Rule = DatasetRule | DimensionRule;
