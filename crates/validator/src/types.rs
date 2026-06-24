use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Error,
    Warning,
    Info,
}

impl Severity {
    /// Ordering used for minSeverity filtering: error(0) < warning(1) < info(2).
    pub fn rank(self) -> u8 {
        match self {
            Severity::Error => 0,
            Severity::Warning => 1,
            Severity::Info => 2,
        }
    }
}

/// A single validation finding. Serialized camelCase to match the TypeScript surface exactly.
#[derive(Debug, Clone, Serialize)]
pub struct Finding {
    pub code: String,
    #[serde(rename = "ruleId")]
    pub rule_id: String,
    pub severity: Severity,
    pub path: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actual: Option<serde_json::Value>,
    #[serde(rename = "specRef")]
    pub spec_ref: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Summary {
    pub errors: usize,
    pub warnings: usize,
    pub infos: usize,
    #[serde(rename = "structuralErrors")]
    pub structural_errors: usize,
    #[serde(rename = "byCode")]
    pub by_code: BTreeMap<String, usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub truncated: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ResultMeta {
    #[serde(rename = "engineVersion")]
    pub engine_version: String,
    #[serde(rename = "ruleSetVersion")]
    pub rule_set_version: String,
    #[serde(rename = "schemaVersion")]
    pub schema_version: String,
    #[serde(rename = "durationMs")]
    pub duration_ms: u128,
}

#[derive(Debug, Clone, Serialize)]
pub struct ResolvedOptions {
    pub mode: String,
    #[serde(rename = "minSeverity")]
    pub min_severity: Severity,
    #[serde(rename = "maxCollectionDepth")]
    pub max_collection_depth: usize,
    #[serde(rename = "continueOnStructuralError")]
    pub continue_on_structural_error: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub findings: Vec<Finding>,
    pub summary: Summary,
    pub options: ResolvedOptions,
    pub meta: ResultMeta,
}

/// Input options (all optional). Deserialized camelCase to match the TS API.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct ValidateOptions {
    pub mode: Option<String>,
    #[serde(rename = "minSeverity")]
    pub min_severity: Option<Severity>,
    #[serde(rename = "maxCollectionDepth")]
    pub max_collection_depth: Option<usize>,
    #[serde(rename = "continueOnStructuralError")]
    pub continue_on_structural_error: Option<bool>,
}

pub fn resolve_options(o: &ValidateOptions) -> ResolvedOptions {
    ResolvedOptions {
        mode: o.mode.clone().unwrap_or_else(|| "full".to_string()),
        min_severity: o.min_severity.unwrap_or(Severity::Info),
        max_collection_depth: o.max_collection_depth.unwrap_or(3),
        continue_on_structural_error: o.continue_on_structural_error.unwrap_or(true),
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct ManifestRule {
    pub id: String,
    pub code: String,
    pub severity: Severity,
    #[serde(rename = "appliesTo")]
    pub applies_to: String,
    #[serde(rename = "specRef")]
    pub spec_ref: String,
    pub message: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ManifestData {
    #[serde(rename = "engineVersion")]
    pub engine_version: String,
    #[serde(rename = "ruleSetVersion")]
    pub rule_set_version: String,
    #[serde(rename = "schemaVersion")]
    pub schema_version: String,
    pub rules: Vec<ManifestRule>,
}
