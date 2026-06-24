import { lookupRule, MANIFEST } from "./manifest.js";
import type { Ctx, Finding, ResolvedOptions } from "./types.js";
import { RULES } from "./rules/index.js";

export interface Analyzed {
  idArr: string[] | null;
  sizeArr: number[] | null;
  idSet: Set<string> | null;
  product: bigint | null;
  productOverflow: boolean;
}

/** Compute id/size arrays, the valid id set, and the safe (overflow-checked) product(size). */
export function analyzeDataset(doc: any, maxCells: number): Analyzed {
  const rawId = Array.isArray(doc?.id) ? (doc.id as any[]) : null;
  const rawSize = Array.isArray(doc?.size) ? (doc.size as any[]) : null;
  const idArr = rawId as string[] | null;
  const idSet = rawId ? new Set(rawId.filter((x: any) => typeof x === "string") as string[]) : null;

  let product: bigint | null = null;
  let productOverflow = false;
  if (rawSize && rawSize.every((s: any) => typeof s === "number" && Number.isInteger(s) && s >= 0)) {
    const sizes = rawSize as number[];
    let p = 1n;
    for (const s of sizes) {
      p *= BigInt(s);
      if (p > BigInt(maxCells)) {
        productOverflow = true;
        break;
      }
    }
    product = productOverflow ? null : p;
  }
  return { idArr, sizeArr: rawSize as number[] | null, idSet, product, productOverflow };
}

/** Run all registered rules against a dataset node, pushing findings into `sink`. */
export function runSemantic(
  doc: any,
  rootPointer: string,
  opts: ResolvedOptions,
  analyzed: Analyzed,
  sink: (f: Finding) => void,
): void {
  const finding: Ctx["finding"] = (ruleId, partial) => {
    const r = lookupRule(ruleId);
    sink({
      code: r.code,
      ruleId: r.id,
      severity: r.severity,
      specRef: r.specRef,
      ...partial,
    });
  };

  const ctx: Ctx = {
    doc,
    rootPointer,
    opts,
    manifest: MANIFEST,
    finding,
    product: analyzed.product,
    productOverflow: analyzed.productOverflow,
    idArr: analyzed.idArr,
    sizeArr: analyzed.sizeArr,
    idSet: analyzed.idSet,
  };

  const dims = doc?.dimension && typeof doc.dimension === "object" ? (doc.dimension as Record<string, any>) : null;

  for (const rule of RULES) {
    if (rule.kind === "dataset") {
      rule.check(ctx);
    } else {
      if (!dims || !analyzed.idArr) continue; // degraded: cannot map dimensions to sizes
      for (let i = 0; i < analyzed.idArr.length; i++) {
        const dimId = analyzed.idArr[i];
        if (!dimId || typeof dimId !== "string") continue;
        const dim = dims[dimId];
        if (!dim || typeof dim !== "object") continue;
        const size = analyzed.sizeArr && i < analyzed.sizeArr.length ? (analyzed.sizeArr[i] ?? null) : null;
        rule.check(ctx, dimId, dim, size);
      }
    }
  }
}
