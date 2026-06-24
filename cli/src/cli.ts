#!/usr/bin/env node
// jsonstat-validate — CLI for @jsonstat-validator/ts.
// Usage: jsonstat-validate <file|-> [--mode full|structural|semantic]
//                            [--format json|text] [--min-severity error|warning|info]
// Exit code 0 when valid, 1 when invalid.
import { readFileSync } from "node:fs";
import { validate, type ValidateOptions, type ValidationResult } from "../../packages/ts/src/index.js";

interface CliOpts {
  mode: ValidateOptions["mode"];
  format: "json" | "text";
  minSeverity: NonNullable<ValidateOptions["minSeverity"]>;
}

function parseArgs(argv: string[]): { opts: CliOpts; file: string | undefined } {
  const opts: CliOpts = { mode: "full", format: "text", minSeverity: "info" };
  let file: string | undefined;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--mode") opts.mode = argv[++i] as CliOpts["mode"];
    else if (a === "--format") opts.format = argv[++i] as CliOpts["format"];
    else if (a === "--min-severity") opts.minSeverity = argv[++i] as CliOpts["minSeverity"];
    else if (a === "--structural-only") opts.mode = "structural";
    else if (a === "--semantic-only") opts.mode = "semantic";
    else if (a === "--help" || a === "-h") {
      console.error("usage: jsonstat-validate <file|-> [--mode full|structural|semantic] [--format json|text] [--min-severity error|warning|info]");
      process.exit(2);
    } else file = a;
  }
  return { opts, file };
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c: string) => (data += c));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

function printText(r: ValidationResult): void {
  console.log(`valid: ${r.valid}`);
  console.log(`summary: ${r.summary.errors} errors, ${r.summary.warnings} warnings, ${r.summary.infos} infos, ${r.summary.structuralErrors} structural`);
  for (const f of r.findings) {
    console.log(`  [${f.severity}] ${f.code}  ${f.path}  — ${f.message}`);
  }
}

async function main(): Promise<void> {
  const { opts, file } = parseArgs(process.argv);
  if (!file) {
    console.error("usage: jsonstat-validate <file|-> [--mode full|structural|semantic] [--format json|text] [--min-severity error|warning|info]");
    process.exit(2);
  }
  const text = file === "-" ? await readStdin() : readFileSync(file, "utf8");
  const result = validate(text, { mode: opts.mode, minSeverity: opts.minSeverity });
  if (opts.format === "json") console.log(JSON.stringify(result, null, 2));
  else printText(result);
  process.exit(result.valid ? 0 : 1);
}

main();
