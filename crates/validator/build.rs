// Build script: keeps src/_vendored/ in sync with the monorepo-root single sources of truth
// (../../rules-manifest.json and ../../schemas/vendored/*.json) during LOCAL development.
//
// Why this exists: the crate embeds those shared files via include_str!("src/_vendored/...").
// We can't include_str! from ../../ directly because `cargo publish`/`cargo package` only pack
// files INSIDE the package directory, then re-verify compilation from the extracted tarball —
// where ../../ no longer exists (the verification build is isolated from the repo root).
//
// Two operating modes:
//  - LOCAL dev: the repo root IS reachable (../../rules-manifest.json exists). build.rs copies the
//    5 shared files into src/_vendored/ so edits at the root are picked up automatically.
//  - PACKAGE/VERIFY (cargo publish, cargo package): the extracted tarball has no repo root. build.rs
//    detects the missing source and becomes a no-op — src/_vendored/ is committed and already packed,
//    so include_str! resolves directly. This is what makes the published crate self-contained.
//
// The committed src/_vendored/ snapshot is kept byte-identical to the root sources (build.rs would
// rewrite it without producing a git diff), and a CI parity test can assert that.
use std::fs;
use std::path::Path;

// crates/validator/ is two levels below the repo root (validator/crates/validator).
const REPO_ROOT_REL: &str = "../..";

const ASSETS: &[(&str, &str)] = &[
    // (source relative to repo root, destination relative to crate src/_vendored/)
    ("rules-manifest.json", "manifest/rules-manifest.json"),
    ("schemas/vendored/dataset.json", "schemas/dataset.json"),
    ("schemas/vendored/collection.json", "schemas/collection.json"),
    ("schemas/vendored/dimension.json", "schemas/dimension.json"),
    ("schemas/vendored/index.json", "schemas/index.json"),
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

    // LOCAL dev mode: repo root reachable → sync from the single sources of truth.
    println!(
        "cargo:rerun-if-changed={}",
        source_marker.display()
    );
    for entry in fs::read_dir(repo_root.join("schemas").join("vendored"))
        .expect("build.rs: could not read schemas/vendored")
    {
        let entry = entry.expect("dir entry");
        println!("cargo:rerun-if-changed={}", entry.path().display());
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
