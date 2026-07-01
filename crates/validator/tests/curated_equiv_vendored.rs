// Curated≡vendored structural parity (Rust mirror of the TS curated-parity.test.ts).
//
// Asserts the de-duplicated, bundled curated schemas (schemas/curated/bundled/*.json — produced by
// tools/bundle-schemas.mjs) are SEMANTICALLY EQUIVALENT to the verbatim upstream originals
// (schemas/vendored/*.json) on every corpus case. DESIGN.md §2.3 guard, Rust side.
//
// Known wrinkle: the vendored `updated` pattern carries an invalid `\-` escape. The Rust `regex`
// crate rejects it, so `validator_for()` on a VENDORED schema ERRORS — which is exactly the latent
// bug the curated set fixes. When that happens we cannot compare outcomes for that file (there is
// no validator to run); we record it as a known-skip for that one schema and still compare the
// OTHER three. The curated set must compile cleanly (no skip allowed) — that is the regression
// guard for the fix.
use jsonschema::validator_for;
use serde_json::Value;
use std::collections::BTreeSet;

const NAMES: &[&str] = &["dataset", "collection", "dimension", "index"];

fn load(root: &std::path::Path, dir: &str, name: &str) -> Value {
    let p = root.join(dir).join(format!("{name}.json"));
    let txt = std::fs::read_to_string(&p).unwrap_or_else(|e| panic!("could not read {p:?}: {e}"));
    serde_json::from_str(&txt).unwrap_or_else(|e| panic!("{p:?} is not valid JSON: {e}"))
}

fn pick_key(cls: Option<&str>) -> &'static str {
    match cls {
        Some("dataset") => "dataset",
        Some("collection") => "collection",
        Some("dimension") => "dimension",
        _ => "index",
    }
}

/// Sorted set of violation instancePaths (normalized: empty path -> "/"). Keyword is intentionally
/// NOT compared (ajv/jsonschema may emit different keyword sequences for equivalent schemas).
fn signature(validator: &jsonschema::Validator, doc: &Value) -> (bool, BTreeSet<String>) {
    match validator.validate(doc) {
        Ok(()) => (true, BTreeSet::new()),
        Err(errs) => {
            let paths: BTreeSet<String> = errs
                .map(|e| {
                    let raw = e.instance_path.to_string();
                    if raw.is_empty() {
                        "/".to_string()
                    } else {
                        format!("/{raw}")
                    }
                })
                .collect();
            (false, paths)
        }
    }
}

#[test]
fn curated_equiv_vendored_structural() {
    let crate_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let root = crate_dir.join("../..");
    if !root.join("corpus").exists() {
        eprintln!(
            "curated_equiv_vendored: repo root not present (cargo publish verify); skipping."
        );
        return;
    }

    // Load + compile BOTH sets. The curated set MUST compile (the `\-` fix is the point); the
    // vendored set is EXPECTED to fail compilation on files whose `updated` pattern carries the
    // bad escape — those go into `vendored_skipped`.
    let mut curated_v: std::collections::HashMap<&str, jsonschema::Validator> = HashMap::new();
    let mut vendored_v: std::collections::HashMap<&str, jsonschema::Validator> = HashMap::new();
    let mut vendored_skipped: Vec<&str> = Vec::new();
    for n in NAMES {
        let cur = load(&root, "schemas/curated/bundled", n);
        curated_v.insert(
            n,
            validator_for(&cur).expect("curated schema must compile (the `\\-` fix is required)"),
        );
        let ven = load(&root, "schemas/vendored", n);
        match validator_for(&ven) {
            Ok(v) => {
                vendored_v.insert(n, v);
            }
            Err(_) => vendored_skipped.push(n), // vendored `\-` bug — known, skip its outcomes
        }
    }

    let corpus_path = root.join("corpus/cases.json");
    let cases: Vec<Value> = serde_json::from_str(
        &std::fs::read_to_string(&corpus_path)
            .unwrap_or_else(|e| panic!("could not read {corpus_path:?}: {e}")),
    )
    .expect("corpus must parse");

    let mut mismatches: Vec<String> = Vec::new();
    for c in &cases {
        let cls = c["input"]["class"].as_str();
        let key = pick_key(cls);
        // Only compare when BOTH sets compiled this schema. If vendored skipped it (the `\-` bug),
        // there is no vendored validator to diff against — skip silently.
        let (Some(cv), Some(vv)) = (curated_v.get(key), vendored_v.get(key)) else {
            continue;
        };
        let (cb, cp) = signature(cv, &c["input"]);
        let (vb, vp) = signature(vv, &c["input"]);
        let id = c["id"].as_str().unwrap_or("?");
        if cb != vb {
            mismatches.push(format!("{id} [{key}]: ok curated={cb} vendored={vb}"));
        } else if cp != vp {
            mismatches.push(format!(
                "{id} [{key}]: violation paths differ\n      curated ={cp:?}\n      vendored={vp:?}"
            ));
        }
    }

    assert!(
        mismatches.is_empty(),
        "curated≡vendored structural parity failed ({}):\n{}",
        mismatches.len(),
        mismatches.join("\n")
    );

    // If the vendored set ever compiles cleanly across the board (upstream fixes the `\-` escape),
    // `vendored_skipped` becomes empty and the comparison above covers all four schemas — which is
    // strictly better. Log it so the test output reflects reality.
    if !vendored_skipped.is_empty() {
        eprintln!(
            "curated_equiv_vendored: vendored {} skipped outcome comparison (known `\\-` regex \
             escape bug); curated set compiled all 4 cleanly. Parity checked on the rest.",
            vendored_skipped.join(", ")
        );
    }
}

use std::collections::HashMap;
