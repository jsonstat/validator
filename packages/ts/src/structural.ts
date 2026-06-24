// Structural pass: REUSES (does not reimplement) the official JSON-stat 2.0 JSON Schema 2020-12
// definitions vendored in schemas/vendored/. Violations are normalized into the same Finding shape
// the semantic engine uses, with code STRUCTURAL_VIOLATION and the ajv keyword retained in `meta`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Finding } from "./types.js";
import { lookupRule } from "./manifest.js";

// ajv ships the 2020-12 dialect as a separate build; its bundled types resolve at this path.
// @ts-ignore - ajv/dist/2020.js declaration resolution varies across ajv versions
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const here = path.dirname(fileURLToPath(import.meta.url));
const vendoredDir = path.resolve(here, "../../../schemas/vendored");

function loadSchema(name: string): any {
  return JSON.parse(readFileSync(path.join(vendoredDir, name), "utf8"));
}

// The vendored schemas use `\-` (escaped hyphen) in the `updated` date pattern, which is an
// invalid escape under a Unicode-flag RegExp. None of the schemas use Unicode property escapes,
// so disabling unicodeRegExp keeps identical matching while letting the patterns compile.
const ajv = new (Ajv2020 as any)({ allErrors: true, strict: false, unicodeRegExp: false });
(addFormats as any)(ajv);

const compiled = {
  dataset: ajv.compile(loadSchema("dataset.json")),
  collection: ajv.compile(loadSchema("collection.json")),
  dimension: ajv.compile(loadSchema("dimension.json")),
  index: ajv.compile(loadSchema("index.json")),
};

function pickValidator(doc: any): (data: any) => boolean {
  const cls = doc?.class;
  if (cls === "dataset") return compiled.dataset;
  if (cls === "collection") return compiled.collection;
  if (cls === "dimension") return compiled.dimension;
  return compiled.index; // general oneOf of all three classes
}

export function validateStructural(doc: any): { ok: boolean; findings: Finding[] } {
  const validate = pickValidator(doc);
  if (validate(doc)) return { ok: true, findings: [] };
  const r = lookupRule("STRUCT");
  const errs = (validate as any).errors ?? [];
  const findings: Finding[] = errs.map((e: any) => ({
    code: r.code,
    ruleId: r.id,
    severity: r.severity,
    specRef: r.specRef,
    path: e.instancePath || "/",
    message: e.message ?? "JSON Schema violation",
    meta: { keyword: e.keyword, schemaPath: e.schemaPath, params: e.params },
  }));
  return { ok: false, findings };
}
