// Dataset-level semantic rules: S1-S8 + C2 (bundle deprecation).
// Overflow (OVF) is emitted by the pipeline; here we guard count-based rules on productOverflow.
import type { DatasetRule } from "../types.js";
import { joinPtr } from "../pointer.js";

export const DATASET_RULES: DatasetRule[] = [
  {
    kind: "dataset", id: "S1",
    check(c) {
      if (c.idArr && c.sizeArr && c.idArr.length !== c.sizeArr.length) {
        c.finding("S1", {
          path: joinPtr(c.rootPointer, "id"),
          message: `'id' has ${c.idArr.length} entries but 'size' has ${c.sizeArr.length}; they must be equal.`,
          expected: c.sizeArr.length, actual: c.idArr.length,
        });
      }
    },
  },
  {
    kind: "dataset", id: "S2",
    check(c) {
      const dims = c.doc?.dimension;
      if (!c.idArr || !dims || typeof dims !== "object") return;
      const dimKeys = Object.keys(dims);
      const idSet = c.idSet ?? new Set<string>();
      const missing = c.idArr.filter((x) => !dimKeys.includes(x));
      const extra = dimKeys.filter((x) => !idSet.has(x));
      if (missing.length || extra.length) {
        c.finding("S2", {
          path: joinPtr(c.rootPointer, "dimension"),
          message: `'dimension' keys and 'id' values differ. In 'id' but not 'dimension': [${missing.join(", ")}]. In 'dimension' but not 'id': [${extra.join(", ")}].`,
          expected: c.idArr, actual: dimKeys,
        });
      }
    },
  },
  {
    kind: "dataset", id: "S3",
    check(c) {
      if (c.productOverflow || c.product === null) return;
      const v = c.doc?.value;
      if (!Array.isArray(v)) return; // sparse handled by S4
      if (BigInt(v.length) !== c.product) {
        c.finding("S3", {
          path: joinPtr(c.rootPointer, "value"),
          message: `Dense 'value' length ${v.length} must equal product(size) = ${c.product.toString()}.`,
          expected: c.product.toString(), actual: v.length,
        });
      }
    },
  },
  {
    kind: "dataset", id: "S4",
    check(c) {
      if (c.productOverflow || c.product === null) return;
      const v = c.doc?.value;
      if (!v || typeof v !== "object" || Array.isArray(v)) return;
      const max = c.product - 1n;
      for (const k of Object.keys(v)) {
        if (!/^\d+$/.test(k) || BigInt(k) > max) {
          c.finding("S4", {
            path: joinPtr(c.rootPointer, "value", k),
            message: `Sparse 'value' key '${k}' is out of range [0, ${max.toString()}].`,
            expected: `[0, ${max.toString()}]`, actual: k,
          });
        }
      }
    },
  },
  {
    kind: "dataset", id: "S5",
    check(c) {
      if (!c.idSet) return;
      const role = c.doc?.role;
      if (!role || typeof role !== "object") return;
      for (const r of ["time", "geo", "metric"] as const) {
        const arr = role[r];
        if (!Array.isArray(arr)) continue;
        for (const id of arr) {
          if (typeof id === "string" && !c.idSet.has(id)) {
            c.finding("S5", {
              path: joinPtr(c.rootPointer, "role", r),
              message: `role.${r} references unknown dimension id '${id}'.`,
              expected: [...c.idSet], actual: id,
            });
          }
        }
      }
    },
  },
  {
    kind: "dataset", id: "S6",
    check(c) {
      if (c.productOverflow || c.product === null) return;
      const s = c.doc?.status;
      if (!Array.isArray(s)) return;
      if (BigInt(s.length) !== c.product) {
        c.finding("S6", {
          path: joinPtr(c.rootPointer, "status"),
          message: `Array 'status' length ${s.length} must equal product(size) = ${c.product.toString()}.`,
          expected: c.product.toString(), actual: s.length,
        });
      }
    },
  },
  {
    kind: "dataset", id: "S7",
    check(c) {
      if (c.productOverflow || c.product === null) return;
      const s = c.doc?.status;
      if (!s || typeof s !== "object" || Array.isArray(s)) return;
      const max = c.product - 1n;
      for (const k of Object.keys(s)) {
        if (!/^\d+$/.test(k) || BigInt(k) > max) {
          c.finding("S7", {
            path: joinPtr(c.rootPointer, "status", k),
            message: `Object 'status' key '${k}' is out of range [0, ${max.toString()}].`,
            expected: `[0, ${max.toString()}]`, actual: k,
          });
        }
      }
    },
  },
  {
    kind: "dataset", id: "S8",
    check(c) {
      if (!c.idSet) return;
      const metric = c.doc?.role?.metric;
      if (!Array.isArray(metric)) return;
      const dims = c.doc?.dimension;
      for (const id of metric) {
        if (typeof id !== "string" || !c.idSet.has(id)) continue; // S5 reports unknown ids
        const unit = dims?.[id]?.category?.unit;
        if (!unit || typeof unit !== "object" || Object.keys(unit).length === 0) {
          c.finding("S8", {
            path: joinPtr(c.rootPointer, "dimension", id, "category", "unit"),
            message: `Metric dimension '${id}' has no category.unit.`,
            expected: "non-empty unit object", actual: unit === undefined ? "missing" : "empty",
          });
        }
      }
    },
  },
  {
    kind: "dataset", id: "C2",
    check(c) {
      const d = c.doc;
      if (!d || typeof d !== "object" || Array.isArray(d)) return;
      const cls = d.class;
      if (cls === "dataset" || cls === "collection" || cls === "dimension") return;
      let bundleLike = false;
      for (const k of Object.keys(d)) {
        const v = d[k];
        if (v && typeof v === "object" && (v.class === "dataset" || (Array.isArray(v.value) && Array.isArray(v.id)))) {
          bundleLike = true;
          break;
        }
      }
      if (bundleLike) {
        c.finding("C2", {
          path: c.rootPointer || "/",
          message: "Response looks like a pre-2.0 bundle (root maps dataset IDs to datasets). Bundles are deprecated; use the 'collection' class.",
        });
      }
    },
  },
];
