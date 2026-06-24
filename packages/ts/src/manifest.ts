// Loads the canonical rules-manifest.json from the repo root.
// This is the SINGLE source of truth shared with the Rust surface (include_str!).
// Path note: this file lives at packages/ts/src/, so ../../../ = the package repo root
// (jsonstat-validator/) whether run from src via tsx or from dist via a tsc build.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { ManifestData, ManifestRule } from "./types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.resolve(here, "../../../rules-manifest.json");

export const MANIFEST: ManifestData = JSON.parse(
  readFileSync(manifestPath, "utf8"),
);

const byId = new Map<string, ManifestRule>(MANIFEST.rules.map((r) => [r.id, r]));

export function lookupRule(id: string): ManifestRule {
  const r = byId.get(id);
  if (!r) throw new Error(`jsonstat-validator: unknown rule id "${id}"`);
  return r;
}
