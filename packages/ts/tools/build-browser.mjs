// Produces dist/browser/* — single-file browser bundles for CDN use (<script src> / esm.sh /
// jsDelivr / unpkg). ajv and the vendored schemas are fully inlined, so each file is self-contained.
// The browser entry (src/browser.ts) excludes validateFile(), which requires node:fs.
//
// `node:*` builtins are marked external via a plugin (the JS build API's `external` field accepts
// only string arrays here). The browser entry never references validateFile, so these are dead code
// that never reaches the output.
import esbuild from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, "..");
const entry = path.join(pkgRoot, "src", "browser.ts");
const outDir = path.join(pkgRoot, "dist", "browser");

// Marks node: builtins as external (never bundled into a browser build).
const nodeExternalsPlugin = {
  name: "node-externals",
  setup(build) {
    build.onResolve({ filter: /^node:/ }, (args) => ({ path: args.path, external: true }));
  },
};

const common = {
  entryPoints: [entry],
  bundle: true,
  minify: true,
  platform: "browser",
  target: "es2022",
  sourcemap: true,
  legalComments: "none",
  treeShaking: true,
  plugins: [nodeExternalsPlugin],
};

// Classic <script src="..."> — attaches `JsonstatValidator` to the global object.
await esbuild.build({
  ...common,
  outfile: path.join(outDir, "jsonstat-validator.min.js"),
  format: "iife",
  globalName: "JsonstatValidator",
});

// ESM build for <script type="module"> and bundler / esm.sh consumers.
await esbuild.build({
  ...common,
  outfile: path.join(outDir, "jsonstat-validator.mjs"),
  format: "esm",
});

console.log("build-browser: wrote dist/browser/jsonstat-validator.{min.js,mjs}");
