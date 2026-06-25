// Syncs the repo-root LICENSE into this package dir so it ships in the npm tarball.
// The LICENSE at the repo root is the single source of truth; this keeps the per-package copy fresh
// on every build/publish. Robust cross-platform replacement for an inline `node -e` shell snippet.
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Resolve from the tools dir (here) — robust regardless of which cwd npm invokes us from.
// For packages/ts/tools/sync-license.mjs: here=packages/ts/tools, repoRoot = validator (three up via pkgRoot).
const here = path.dirname(fileURLToPath(import.meta.url)); // <pkg>/tools
const pkgRoot = path.resolve(here, "..");                   // <pkg>  (packages/ts)
const repoRoot = path.resolve(pkgRoot, "..", "..");         // repo root (validator)

copyFileSync(path.join(repoRoot, "LICENSE"), path.join(pkgRoot, "LICENSE"));
console.log("sync-license: copied LICENSE into", path.relative(repoRoot, pkgRoot));
