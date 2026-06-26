pub use crate::types::{ManifestData, ManifestRule};

/// The single source of truth, shared verbatim with the TypeScript surface.
/// Embedded from the copy synced into src/_vendored/manifest/ by build.rs. build.rs copies it from
/// the monorepo-root ../../rules-manifest.json (the shared single source of truth) so the crate stays
/// self-contained for `cargo publish` (which only packs files inside the package directory).
pub const MANIFEST_JSON: &str = include_str!("_vendored/manifest/rules-manifest.json");

pub fn manifest() -> ManifestData {
    serde_json::from_str(MANIFEST_JSON)
        .expect("rules-manifest.json must be valid JSON matching ManifestData")
}

pub fn lookup<'a>(mf: &'a ManifestData, id: &str) -> &'a ManifestRule {
    mf.rules
        .iter()
        .find(|r| r.id == id)
        .unwrap_or_else(|| panic!("jsonstat-validator: unknown rule id \"{id}\""))
}
