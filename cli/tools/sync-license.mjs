// Syncs the repo-root LICENSE into this package dir so it ships in the npm tarball.
// The LICENSE at the repo root is the single source of truth; this keeps the per-package copy fresh
// on every build/publish. Robust cross-platform replacement for an inline `node -e` shell snippet.
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Resolve from the tools dir (here) — robust regardless of which cwd npm invokes us from.
// For cli/tools/sync-license.mjs: here=cli/tools, repoRoot = validator (two levels up).
const here = path.dirname(fileURLToPath(import.meta.url)); // <pkg>/tools
const pkgRoot = path.resolve(here, "..");                   // <pkg>
const repoRoot = path.resolve(here, "..", "..");            // repo root

copyFileSync(path.join(repoRoot, "LICENSE"), path.join(pkgRoot, "LICENSE"));
console.log("sync-license: copied LICENSE into", path.relative(repoRoot, pkgRoot));
