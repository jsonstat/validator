pub use crate::types::{ManifestData, ManifestRule};

/// The single source of truth, shared verbatim with the TypeScript surface.
pub const MANIFEST_JSON: &str = include_str!("../../../rules-manifest.json");

pub fn manifest() -> ManifestData {
    serde_json::from_str(MANIFEST_JSON).expect("rules-manifest.json must be valid JSON matching ManifestData")
}

pub fn lookup<'a>(mf: &'a ManifestData, id: &str) -> &'a ManifestRule {
    mf.rules
        .iter()
        .find(|r| r.id == id)
        .unwrap_or_else(|| panic!("jsonstat-validator: unknown rule id \"{id}\""))
}
