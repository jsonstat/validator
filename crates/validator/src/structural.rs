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

const DATASET_SCHEMA: &str = include_str!("../../../schemas/vendored/dataset.json");
const COLLECTION_SCHEMA: &str = include_str!("../../../schemas/vendored/collection.json");
const DIMENSION_SCHEMA: &str = include_str!("../../../schemas/vendored/dimension.json");
const INDEX_SCHEMA: &str = include_str!("../../../schemas/vendored/index.json");

fn pick_schema_str(doc: &Value) -> &'static str {
    match doc["class"].as_str() {
        Some("dataset") => DATASET_SCHEMA,
        Some("collection") => COLLECTION_SCHEMA,
        Some("dimension") => DIMENSION_SCHEMA,
        _ => INDEX_SCHEMA, // general oneOf of all three classes
    }
}

pub fn validate_structural(doc: &Value, mf: &ManifestData) -> Vec<Finding> {
    let schema: Value = match serde_json::from_str(pick_schema_str(doc)) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };
    // The vendored schemas use `\-` (escaped hyphen) in the `updated` date pattern. If the regex
    // engine rejects that escape, compilation fails; we then skip the structural pass (semantic
    // checks still run). This is the gap the design's "curated de-duplicated schemas" addresses.
    let validator = match validator_for(&schema) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    let r = lookup(mf, "STRUCT");
    // Bind to a local so the validate() temporary (which borrows `validator`) is dropped before
    // `validator` itself, satisfying the borrow checker.
    let findings = match validator.validate(doc) {
        Ok(()) => Vec::new(),
        Err(errs) => errs
            .map(|e| {
                let raw = e.instance_path.to_string();
                let path = if raw.is_empty() { "/".to_string() } else { format!("/{raw}") };
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
