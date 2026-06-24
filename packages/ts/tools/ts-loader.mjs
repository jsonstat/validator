// Pure-JS ESM loader: transpiles .ts with the (already-installed, dependency-free-of-native-code)
// `typescript` package and remaps relative "./x.js" specifiers to "./x.ts". This keeps imports as
// ".js" (correct for the tsc build output) while letting us run straight from source on platforms
// where esbuild's native binary (pulled in by tsx) does not work.
import { readFileSync } from "node:fs";
import ts from "typescript";

export async function resolve(specifier, context, nextResolve) {
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    specifier.endsWith(".js")
  ) {
    const candidate = specifier.slice(0, -3) + ".ts";
    try {
      return await nextResolve(candidate, context);
    } catch {
      // fall through to the original ".js" specifier
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith("file:") && url.endsWith(".ts")) {
    const source = readFileSync(new URL(url), "utf8");
    const out = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        sourceMap: false,
      },
    });
    return { format: "module", source: out.outputText, shortCircuit: true };
  }
  return nextLoad(url, context);
}
