// Build script: keeps src/_vendored/ in sync with the monorepo-root single sources of truth during
// LOCAL development: the manifest (../../rules-manifest.json) and the BUNDLED CURATED schemas
// (../../schemas/curated/bundled/*.json — the self-contained output of tools/bundle-schemas.mjs,
// which inlines the de-duplicated schemas/curated/*.json that $ref into core.json).
//
// Why the curated/bundled set (not schemas/vendored/): the vendored originals are the verbatim
// upstream quote source; the curated set is the de-duplicated, bundled equivalent the validator
// actually loads at runtime (as of 1.0.0). A CI curated-equiv-vendored parity test asserts the two
// are semantically identical. The curated set also fixes the `\-` RegExp escape the vendored
// `updated` pattern carries, so the structural pass compiles cleanly with no silent-skip fallback.
//
// Why this exists: the crate embeds those shared files via include_str!("src/_vendored/...").
// We can't include_str! from ../../ directly because `cargo publish`/`cargo package` only pack
// files INSIDE the package directory, then re-verify compilation from the extracted tarball —
// where ../../ no longer exists (the verification build is isolated from the repo root).
//
// Two operating modes:
//  - LOCAL dev: the repo root IS reachable (../../rules-manifest.json exists). build.rs copies the
//    shared files into src/_vendored/ so edits at the root (+ a re-bundle) are picked up.
//  - PACKAGE/VERIFY (cargo publish, cargo package): the extracted tarball has no repo root. build.rs
//    detects the missing source and becomes a no-op — src/_vendored/ is committed and already packed,
//    so include_str! resolves directly. This is what makes the published crate self-contained.
//
// The committed src/_vendored/ snapshot is kept byte-identical to the root bundled sources
// (build.rs would rewrite it without producing a git diff), and vendored_parity.rs asserts that
// in CI.
use std::fs;
use std::path::Path;

// crates/validator/ is two levels below the repo root (validator/crates/validator).
const REPO_ROOT_REL: &str = "../..";

const ASSETS: &[(&str, &str)] = &[
    // (source relative to repo root, destination relative to crate src/_vendored/)
    ("rules-manifest.json", "manifest/rules-manifest.json"),
    (
        "schemas/curated/bundled/dataset.json",
        "schemas/dataset.json",
    ),
    (
        "schemas/curated/bundled/collection.json",
        "schemas/collection.json",
    ),
    (
        "schemas/curated/bundled/dimension.json",
        "schemas/dimension.json",
    ),
    ("schemas/curated/bundled/index.json", "schemas/index.json"),
];

fn main() {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR")
        .expect("CARGO_MANIFEST_DIR is always set by Cargo for build scripts");
    let crate_dir = Path::new(&manifest_dir);
    let repo_root = crate_dir.join(REPO_ROOT_REL);
    let vendored_dir = crate_dir.join("src").join("_vendored");

    // Always re-run if build.rs itself changes.
    println!("cargo:rerun-if-changed=build.rs");

    let source_marker = repo_root.join("rules-manifest.json");
    if !source_marker.exists() {
        // PACKAGE/VERIFY mode: no repo root above the package. src/_vendored/ is committed and
        // already present in the packed sources, so there is nothing to sync. Re-run only if those
        // committed files change.
        for (_, dst_rel) in ASSETS {
            println!("cargo:rerun-if-changed=src/_vendored/{}", dst_rel);
        }
        return;
    }

    // LOCAL dev mode: repo root reachable → sync from the single sources of truth. The schema
    // source is the BUNDLED curated set (schemas/curated/bundled/, produced by `npm run bundle`
    // from schemas/curated/*.json + core.json). Watch both: editing the authored source OR
    // re-running the bundler should trigger a re-sync into src/_vendored/.
    println!("cargo:rerun-if-changed={}", source_marker.display());
    for sub in ["bundled", ""] {
        let dir = repo_root.join("schemas").join("curated").join(sub);
        for entry in fs::read_dir(&dir)
            .unwrap_or_else(|_| panic!("build.rs: could not read {}", dir.display()))
        {
            let entry = entry.expect("dir entry");
            println!("cargo:rerun-if-changed={}", entry.path().display());
        }
    }

    for (src_rel, dst_rel) in ASSETS {
        let src = repo_root.join(src_rel);
        let dst = vendored_dir.join(dst_rel);
        if let Some(parent) = dst.parent() {
            fs::create_dir_all(parent).expect("build.rs: create_dir_all failed");
        }
        fs::copy(&src, &dst).unwrap_or_else(|e| {
            panic!(
                "build.rs: could not copy {} -> {}: {}",
                src.display(),
                dst.display(),
                e
            )
        });
    }

    println!(
        "cargo:warning=jsonstat-validator: synced {} shared assets into src/_vendored/",
        ASSETS.len()
    );
}
