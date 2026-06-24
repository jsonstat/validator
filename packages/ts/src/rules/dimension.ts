// Dimension-level semantic rules: D1-D7 (D3 splits into D3a error + D3b warning).
import type { DimensionRule } from "../types.js";
import { joinPtr } from "../pointer.js";
import { indexIdSet, childGraphHasCycle } from "./_shared.js";

export const DIMENSION_RULES: DimensionRule[] = [
  {
    kind: "dimension", id: "D1",
    check(c, dimId, dim, size) {
      const idx = dim?.category?.index;
      if (!Array.isArray(idx)) return; // object form is D2
      if (size === null) return;
      if (idx.length !== size) {
        c.finding("D1", {
          path: joinPtr(c.rootPointer, "dimension", dimId, "category", "index"),
          message: `Dimension '${dimId}' index has ${idx.length} categories but size is ${size}.`,
          expected: size, actual: idx.length,
        });
      }
    },
  },
  {
    kind: "dimension", id: "D2",
    check(c, dimId, dim, size) {
      const idx = dim?.category?.index;
      if (!idx || typeof idx !== "object" || Array.isArray(idx)) return;
      if (size === null) return;
      const vals = Object.values(idx).map((v) => Number(v));
      const set = new Set(vals);
      const ok = vals.length === size && Array.from({ length: size }, (_, i) => i).every((i) => set.has(i));
      if (!ok) {
        c.finding("D2", {
          path: joinPtr(c.rootPointer, "dimension", dimId, "category", "index"),
          message: `Dimension '${dimId}' index positions are not a permutation of [0, ${size - 1}].`,
          expected: `[0..${size - 1}]`, actual: vals,
        });
      }
    },
  },
  {
    kind: "dimension", id: "D3a",
    check(c, dimId, dim) {
      const label = dim?.category?.label;
      if (!label || typeof label !== "object") return;
      const ids = indexIdSet(dim);
      if (!ids) return;
      const unknown = Object.keys(label).filter((k) => !ids.has(k));
      if (unknown.length) {
        c.finding("D3a", {
          path: joinPtr(c.rootPointer, "dimension", dimId, "category", "label"),
          message: `Dimension '${dimId}' label has unknown category ids: [${unknown.join(", ")}].`,
          expected: [...ids], actual: Object.keys(label),
        });
        return;
      }
      const missing = [...ids].filter((id) => !(id in label));
      if (missing.length) {
        c.finding("D3b", {
          path: joinPtr(c.rootPointer, "dimension", dimId, "category", "label"),
          message: `Dimension '${dimId}' label is missing categories: [${missing.join(", ")}].`,
          expected: [...ids], actual: Object.keys(label),
        });
      }
    },
  },
  {
    kind: "dimension", id: "D4",
    check(c, dimId, dim) {
      const unit = dim?.category?.unit;
      if (!unit || typeof unit !== "object") return;
      const ids = indexIdSet(dim);
      if (!ids) return;
      const unknown = Object.keys(unit).filter((k) => !ids.has(k));
      if (unknown.length) {
        c.finding("D4", {
          path: joinPtr(c.rootPointer, "dimension", dimId, "category", "unit"),
          message: `Dimension '${dimId}' unit has unknown category ids: [${unknown.join(", ")}].`,
          expected: [...ids], actual: Object.keys(unit),
        });
      }
    },
  },
  {
    kind: "dimension", id: "D5",
    check(c, dimId, dim) {
      const coord = dim?.category?.coordinates;
      if (!coord || typeof coord !== "object") return;
      const ids = indexIdSet(dim);
      if (!ids) return;
      const unknown = Object.keys(coord).filter((k) => !ids.has(k));
      if (unknown.length) {
        c.finding("D5", {
          path: joinPtr(c.rootPointer, "dimension", dimId, "category", "coordinates"),
          message: `Dimension '${dimId}' coordinates has unknown category ids: [${unknown.join(", ")}].`,
          expected: [...ids], actual: Object.keys(coord),
        });
      }
    },
  },
  {
    kind: "dimension", id: "D6",
    check(c, dimId, dim) {
      const note = dim?.category?.note;
      if (!note || typeof note !== "object") return;
      const ids = indexIdSet(dim);
      if (!ids) return;
      const unknown = Object.keys(note).filter((k) => !ids.has(k));
      if (unknown.length) {
        c.finding("D6", {
          path: joinPtr(c.rootPointer, "dimension", dimId, "category", "note"),
          message: `Dimension '${dimId}' note has unknown category ids: [${unknown.join(", ")}].`,
          expected: [...ids], actual: Object.keys(note),
        });
      }
    },
  },
  {
    kind: "dimension", id: "D7a",
    check(c, dimId, dim) {
      const child = dim?.category?.child;
      if (!child || typeof child !== "object") return;
      const ids = indexIdSet(dim);
      if (!ids) return;
      const bad: string[] = [];
      for (const [p, kids] of Object.entries(child)) {
        if (!ids.has(p)) bad.push(p);
        if (Array.isArray(kids)) for (const k of kids) if (typeof k === "string" && !ids.has(k)) bad.push(k);
      }
      if (bad.length) {
        c.finding("D7a", {
          path: joinPtr(c.rootPointer, "dimension", dimId, "category", "child"),
          message: `Dimension '${dimId}' child references unknown category ids: [${[...new Set(bad)].join(", ")}].`,
          expected: [...ids], actual: bad,
        });
      }
    },
  },
  {
    kind: "dimension", id: "D7b",
    check(c, dimId, dim) {
      const child = dim?.category?.child;
      if (!child || typeof child !== "object") return;
      if (childGraphHasCycle(child)) {
        c.finding("D7b", {
          path: joinPtr(c.rootPointer, "dimension", dimId, "category", "child"),
          message: `Dimension '${dimId}' child hierarchy contains a cycle.`,
        });
      }
    },
  },
];
