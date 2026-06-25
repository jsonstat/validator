// Runs after `npm install` at the repo root (npm's "prepare" lifecycle hook). It builds both
// workspaces so that `npx jsonstat-validate` works immediately on a fresh clone (the `cli/dist`
// bin target is gitignored, so it must be regenerated). Skipped under --production or CI.
//
// The root package is "private": true, so prepare NEVER runs on `npm publish` of the root (which is
// impossible anyway) — only on local installs. Per-workspace publish runs its own prepublishOnly.
//
// NOTE:
// - ESM does not allow top-level `return`, so the whole body is wrapped in main().
// - npm links workspace bins BEFORE running prepare, so when the bin target (cli/dist/cli.js) is
//   produced by this build, the node_modules/.bin/ shim is missing. After a successful build we
//   re-link bins with a guarded `npm install` (JSONSTAT_BINRELINK guards against recursion).
import { execSync } from "node:child_process";

function skip(reason) {
  console.log(`prepare: skipping build (${reason})`);
}

function main() {
  if (process.env.npm_config_production) return skip("production install");
  if (process.env.CI) return skip("CI environment");
  // Don't recurse when the build itself triggers nested installs.
  if (process.env.INIT_CWD === undefined) return skip("non-install context");

  try {
    execSync("npm run build", { stdio: "inherit" });
    console.log("prepare: build complete");
  } catch (e) {
    console.error("prepare: build failed; run `npm run build` manually to enable the local CLI");
    // non-fatal: don't break the install over a build failure
    return;
  }

  // Re-link workspace bins now that cli/dist/cli.js exists. npm links bins during `install`,
  // which runs BEFORE prepare — so the shim for our freshly-built bin was never created. A guarded
  // `npm install` re-runs npm's own linking (correctly handling Unix shims + Windows .cmd/.ps1).
  if (process.env.JSONSTAT_BINRELINK) return;
  try {
    execSync("npm install --no-fund --no-audit", {
      stdio: "inherit",
      env: { ...process.env, JSONSTAT_BINRELINK: "1" },
    });
    console.log("prepare: npx jsonstat-validate is now available in this repo");
  } catch (e) {
    console.error("prepare: bin re-link failed; run `npx jsonstat-validate` after `npm run build`");
  }
}

main();
