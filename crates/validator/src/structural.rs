// Structural pass: REUSES the official JSON-stat 2.0 JSON Schema 2020-12 definitions, embedded at
// compile time from schemas/vendored/. Violations are normalized into the Finding shape with
// code STRUCTURAL_VIOLATION.
//
// In jsonschema 0.22, Validator::validate returns Err(Box<dyn Iterator<Item = ValidationError>>),
// i.e. ALL violations, so we map over them.
use crate::manifest::{lookup, ManifestData};
use crate::types::{Finding, Severity};
use jsonschema::validator_for;
use serde_json::Value;

// Embedded from the copies synced into src/_vendored/schemas/ by build.rs, which mirrors the
// monorepo-root ../../schemas/vendored/*.json. Using local copies keeps the crate self-contained for
// `cargo publish` (which only packs files inside the package directory).
const DATASET_SCHEMA: &str = include_str!("_vendored/schemas/dataset.json");
const COLLECTION_SCHEMA: &str = include_str!("_vendored/schemas/collection.json");
const DIMENSION_SCHEMA: &str = include_str!("_vendored/schemas/dimension.json");
const INDEX_SCHEMA: &str = include_str!("_vendored/schemas/index.json");

fn pick_schema_str(doc: &Value) -> &'static str {
    match doc["class"].as_str() {
        Some("dataset") => DATASET_SCHEMA,
        Some("collection") => COLLECTION_SCHEMA,
        Some("dimension") => DIMENSION_SCHEMA,
        _ => INDEX_SCHEMA, // general oneOf of all three classes
    }
}

pub fn validate_structural(doc: &Value, mf: &ManifestData) -> Vec<Finding> {
    let schema: Value = serde_json::from_str(pick_schema_str(doc))
        .expect("embedded curated schema must be valid JSON");
    // As of 1.0.0 the structural pass loads the curated/bundled schemas, which write the `updated`
    // date hyphen literally and compile cleanly (the vendored upstream originals' invalid `\-`
    // escape that previously forced a silent-skip here is gone). A compile failure now indicates a
    // real schema regression, so propagate it as a panic rather than silently no-op-ing.
    let validator = validator_for(&schema)
        .expect("embedded curated schema must compile under the jsonschema engine");
    let r = lookup(mf, "STRUCT");
    // Bind to a local so the validate() temporary (which borrows `validator`) is dropped before
    // `validator` itself, satisfying the borrow checker.
    let findings = match validator.validate(doc) {
        Ok(()) => Vec::new(),
        Err(errs) => errs
            .map(|e| {
                let raw = e.instance_path.to_string();
                let path = if raw.is_empty() {
                    "/".to_string()
                } else {
                    format!("/{raw}")
                };
                Finding {
                    code: r.code.clone(),
                    rule_id: r.id.clone(),
                    severity: Severity::Error,
                    path,
                    message: format!("{e}"),
                    expected: None,
                    actual: None,
                    spec_ref: r.spec_ref.clone(),
                    meta: Some(serde_json::json!({ "keyword": "jsonschema" })),
                }
            })
            .collect(),
    };
    findings
}
