// Produces dist/index.cjs — a CommonJS build for consumers on older Node/require() toolchains.
// Our own src is bundled into a single file; runtime npm deps (ajv, ajv-formats) are left external
// (packages: "external") so they stay deduped in the consumer's node_modules.
import esbuild from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, "..");

await esbuild.build({
  entryPoints: [path.join(pkgRoot, "src", "index.ts")],
  outfile: path.join(pkgRoot, "dist", "index.cjs"),
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "es2022",
  sourcemap: true,
  packages: "external",
});

console.log("build-node-cjs: wrote dist/index.cjs");
