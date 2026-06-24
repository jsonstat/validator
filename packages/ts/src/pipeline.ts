// The validate pipeline: parse -> structural (JSON Schema) -> semantic rules -> aggregate.
import { readFileSync, statSync } from "node:fs";
import { analyzeDataset, runSemantic } from "./engine.js";
import { validateStructural } from "./structural.js";
import { lookupRule } from "./manifest.js";
import { joinPtr } from "./pointer.js";
import { MANIFEST } from "./manifest.js";
import type {
  Finding, ResolvedOptions, Severity, Summary, ValidateOptions, ValidationResult,
} from "./types.js";

const SEV: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

function resolveOptions(o?: ValidateOptions): ResolvedOptions {
  return {
    mode: o?.mode ?? "full",
    minSeverity: o?.minSeverity ?? "info",
    maxCollectionDepth: o?.maxCollectionDepth ?? 3,
    continueOnStructuralError: o?.continueOnStructuralError ?? true,
    onFinding: o?.onFinding,
    budget: {
      maxCells: o?.budget?.maxCells ?? 50_000_000,
      maxBytes: o?.budget?.maxBytes ?? 200 * 1024 * 1024,
      maxFindings: o?.budget?.maxFindings ?? 1000,
    },
  };
}

function summarize(findings: Finding[], truncated: number): Summary {
  const s: Summary = { errors: 0, warnings: 0, infos: 0, structuralErrors: 0, byCode: {} };
  for (const f of findings) {
    if (f.severity === "error") s.errors++;
    else if (f.severity === "warning") s.warnings++;
    else s.infos++;
    if (f.code === "STRUCTURAL_VIOLATION") s.structuralErrors++;
    s.byCode[f.code] = (s.byCode[f.code] ?? 0) + 1;
  }
  if (truncated > 0) s.truncated = truncated;
  return s;
}

function finalize(findings: Finding[], truncated: number, opts: ResolvedOptions, start: number): ValidationResult {
  const valid = findings.every((f) => f.severity !== "error");
  const filtered = findings.filter((f) => SEV[f.severity] <= SEV[opts.minSeverity]);
  return {
    valid,
    findings: filtered,
    summary: summarize(filtered, truncated),
    options: opts,
    meta: {
      engineVersion: MANIFEST.engineVersion,
      ruleSetVersion: MANIFEST.ruleSetVersion,
      schemaVersion: MANIFEST.schemaVersion,
      durationMs: Date.now() - start,
    },
  };
}

export function validate(doc: unknown, options?: ValidateOptions): ValidationResult {
  const start = Date.now();
  const opts = resolveOptions(options);
  const findings: Finding[] = [];
  let truncated = 0;
  const sink = (f: Finding) => {
    if (findings.length < opts.budget.maxFindings) {
      findings.push(f);
      opts.onFinding?.(f);
    } else {
      truncated++;
    }
  };

  let parsed: unknown = doc;
  if (typeof doc === "string") {
    try {
      parsed = JSON.parse(doc);
    } catch (e) {
      const r = lookupRule("PARSE");
      sink({ code: r.code, ruleId: r.id, severity: r.severity, specRef: r.specRef, path: "/", message: `Input is not valid JSON: ${(e as Error).message}` });
      return finalize(findings, truncated, opts, start);
    }
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    const r = lookupRule("STRUCT");
    sink({ code: r.code, ruleId: r.id, severity: r.severity, specRef: r.specRef, path: "/", message: "Root must be a JSON-stat object." });
    return finalize(findings, truncated, opts, start);
  }

  const cls = (parsed as Record<string, any>).class;

  let structuralOk = true;
  if (opts.mode !== "semantic") {
    const res = validateStructural(parsed);
    structuralOk = res.ok;
    for (const f of res.findings) sink(f);
  }

  if (opts.mode !== "structural" && (opts.continueOnStructuralError || structuralOk)) {
    if (cls === "dataset" || looksLikeBundle(parsed)) {
      runOnNode(parsed, "", opts, sink);
    } else if (cls === "collection") {
      runCollection(parsed, "", opts, sink, opts.maxCollectionDepth);
    }
    // dimension-class responses: structural pass covers shape; semantic not run (no size context)
  }

  return finalize(findings, truncated, opts, start);
}

function looksLikeBundle(doc: any): boolean {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return false;
  const cls = doc.class;
  if (cls === "dataset" || cls === "collection" || cls === "dimension") return false;
  for (const k of Object.keys(doc)) {
    const v = doc[k];
    if (v && typeof v === "object" && (v.class === "dataset" || (Array.isArray(v.value) && Array.isArray(v.id)))) {
      return true;
    }
  }
  return false;
}

function runOnNode(doc: any, rootPointer: string, opts: ResolvedOptions, sink: (f: Finding) => void): void {
  const analyzed = analyzeDataset(doc, opts.budget.maxCells);
  if (analyzed.productOverflow) {
    const r = lookupRule("OVF");
    sink({ code: r.code, ruleId: r.id, severity: r.severity, specRef: r.specRef, path: joinPtr(rootPointer, "size"), message: `product(size) exceeds the cell budget (${opts.budget.maxCells}).`, actual: doc?.size });
  }
  runSemantic(doc, rootPointer, opts, analyzed, sink);
}

function runCollection(doc: any, rootPointer: string, opts: ResolvedOptions, sink: (f: Finding) => void, depth: number): void {
  const items = doc?.link?.item;
  if (!Array.isArray(items)) return;
  if (depth <= 0) {
    const r = lookupRule("C1");
    sink({ code: r.code, ruleId: r.id, severity: r.severity, specRef: r.specRef, path: joinPtr(rootPointer, "link", "item"), message: `Collection recursion depth exceeded (max ${opts.maxCollectionDepth}); nested items not validated.` });
    return;
  }
  items.forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const ip = joinPtr(rootPointer, "link", "item", i);
    if (item.class === "dataset" && (item.value !== undefined || item.id !== undefined)) {
      runOnNode(item, ip, opts, sink);
    } else if (item.class === "collection" && item.link) {
      runCollection(item, ip, opts, sink, depth - 1);
    }
    // href-only items are not fetched by default (design D2)
  });
}

export async function validateFile(file: string, options?: ValidateOptions): Promise<ValidationResult> {
  const opts = resolveOptions(options);
  const size = statSync(file).size;
  if (size > opts.budget.maxBytes) {
    const r = lookupRule("BUDGET");
    const findings: Finding[] = [{ code: r.code, ruleId: r.id, severity: r.severity, specRef: r.specRef, path: "/", message: `File size ${size} exceeds maxBytes budget ${opts.budget.maxBytes}.` }];
    return { valid: false, findings, summary: summarize(findings, 0), options: opts, meta: { engineVersion: MANIFEST.engineVersion, ruleSetVersion: MANIFEST.ruleSetVersion, schemaVersion: MANIFEST.schemaVersion, durationMs: 0 } };
  }
  const text = readFileSync(file, "utf8");
  return validate(text, options);
}
