//! jsonstat-validator — Rust surface.
//!
//! Semantic validator for JSON-stat 2.0. REUSES the official JSON Schema 2020-12 definitions
//! (vendored, embedded at compile time) for the structural pass and adds the cross-field cube
//! invariants JSON Schema cannot express (the S/D/C catalogue). Shares `rules-manifest.json`
//! and the conformance corpus with the TypeScript surface for behavioural parity.

pub mod engine;
pub mod manifest;
pub mod pipeline;
pub mod rules;
pub mod structural;
pub mod types;
#[cfg(feature = "wasm")]
pub mod wasm;

pub use manifest::manifest;
pub use pipeline::{validate, validate_from_str};
pub use types::{Finding, Severity, ValidateOptions, ValidationResult};
