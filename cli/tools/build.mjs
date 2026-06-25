// Bundles src/cli.ts into a single self-contained dist/cli.js (ESM, Node). @jsonstat-validator/ts
// and ajv are bundled IN (not external) so `npx jsonstat-validate` works with zero extra installs.
// Resolved at build time via the workspace symlink created by `npm install` at the repo root.
import esbuild from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(here, "..");

// Note: the source file cli/src/cli.ts already begins with a `#!/usr/bin/env node` shebang, which
// esbuild preserves. We deliberately do NOT add a banner shebang here (that would duplicate it and
// break Node's ESM parser).
await esbuild.build({
  entryPoints: [path.join(cliRoot, "src", "cli.ts")],
  outfile: path.join(cliRoot, "dist", "cli.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "es2022",
  sourcemap: true,
  allowOverwrite: true,
});

console.log("build: wrote dist/cli.js");
