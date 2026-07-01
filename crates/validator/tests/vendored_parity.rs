// Snapshot drift guard: the COMMITTED `src/_vendored/` snapshot must stay byte-identical to the
// repo-root single sources of truth it is generated from — the manifest (`../../rules-manifest.json`)
// and the BUNDLED CURATED schemas (`../../schemas/curated/bundled/*.json`).
//
// Why this exists: `build.rs` re-syncs the snapshot into the *working tree* on every local build,
// but that mutation is uncommitted — so the working tree always looks correct and CI can pass while
// the *publishable* snapshot is stale. A naive test that reads the on-disk snapshot would therefore
// always pass (build.rs just fixed it).
//
// Fix: compare the COMMITTED blobs (`git show HEAD:<...>`) for the root source vs the snapshot.
// build.rs only ever writes the working tree, never git, so this is the drift signal the corpus
// parity test cannot see (it also catches pure-metadata drift, e.g. a bumped `engineVersion`).
//
// NOTE (1.0.0): the schema source is the CURATED/BUNDLED set (de-duplicated, `\-` fixed), NOT the
// verbatim `schemas/vendored/` originals. build.rs copies curated/bundled -> src/_vendored/, and the
// semantic equivalence of curated vs vendored is asserted separately by curated_equiv_vendored.rs
// (DESIGN.md §2.3 guard). This test only enforces that the EMBEDDED snapshot matches whatever the
// bundler produced — i.e. "you re-ran `npm run bundle` and committed the result".
//
// Skips (no-op) when the repo root is absent (`cargo publish` / `cargo package` verify mode, where
// the extracted tarball has no `../..`) or when git / tracked files are unavailable — mirroring
// build.rs's own repo-root detection.
use std::path::PathBuf;

// (git-relative root source, git-relative committed snapshot) — layout is stable, so hard-coded.
// MUST stay in lock-step with build.rs's ASSETS table (same sources, same destinations).
const ASSETS: &[(&str, &str)] = &[
    (
        "rules-manifest.json",
        "crates/validator/src/_vendored/manifest/rules-manifest.json",
    ),
    (
        "schemas/curated/bundled/dataset.json",
        "crates/validator/src/_vendored/schemas/dataset.json",
    ),
    (
        "schemas/curated/bundled/collection.json",
        "crates/validator/src/_vendored/schemas/collection.json",
    ),
    (
        "schemas/curated/bundled/dimension.json",
        "crates/validator/src/_vendored/schemas/dimension.json",
    ),
    (
        "schemas/curated/bundled/index.json",
        "crates/validator/src/_vendored/schemas/index.json",
    ),
];

/// Read a committed blob from git (`HEAD:<path>`), path relative to the repo root. Returns None if
/// git is missing, the path is untracked, or the command fails.
fn git_show_head(path: &str) -> Option<Vec<u8>> {
    let out = std::process::Command::new("git")
        .args(["show", &format!("HEAD:{path}")])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    Some(out.stdout)
}

#[test]
fn committed_snapshot_matches_curated_bundled_sources() {
    let crate_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let repo_root = crate_dir.join("../..");

    // cargo publish / cargo package verify mode: extracted tarball, no repo root -> nothing to sync.
    if !repo_root.join("rules-manifest.json").exists() {
        eprintln!("vendored_parity: repo root not present (cargo publish verify mode); skipping.");
        return;
    }

    // No git / files not tracked yet -> cannot compare committed state; skip rather than spuriously
    // fail (the on-disk snapshot is already kept correct by build.rs in that case).
    if git_show_head("rules-manifest.json").is_none() {
        eprintln!(
            "vendored_parity: git unavailable or sources untracked; skipping committed-blob check."
        );
        return;
    }

    let mut diffs: Vec<String> = Vec::new();
    for (src, snap) in ASSETS {
        let root_blob = git_show_head(src).unwrap_or_default();
        let snap_blob = git_show_head(snap).unwrap_or_default();
        if root_blob != snap_blob {
            diffs.push(format!(
                "HEAD:{src} ({} bytes)  !=  HEAD:{snap} ({} bytes)",
                root_blob.len(),
                snap_blob.len()
            ));
        }
    }

    assert!(
        diffs.is_empty(),
        "Committed `_vendored` snapshot has drifted from the repo-root sources ({}). build.rs \
         silently re-syncs the WORKING TREE on every build, so this only surfaces here. The schema \
         source is `schemas/curated/bundled/` (the bundled curated set); if you edited \
         `schemas/curated/*.json`, re-run `npm run bundle` to regenerate the bundled output, then \
         `cargo build` in crates/validator (build.rs copies root -> src/_vendored), then COMMIT the \
         updated snapshot so the publishable tarball and the repo agree:\n{}",
        diffs.len(),
        diffs.join("\n")
    );
}
