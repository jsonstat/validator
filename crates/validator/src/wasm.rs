// WebAssembly surface (compiled automatically when target_arch == "wasm32"). Mirrors the TS
// validate() signature. A panic hook routes Rust panics to the JS console with a location, so
// failures surface as readable messages instead of an opaque `unreachable` trap.
#![cfg(target_arch = "wasm32")]

use crate::pipeline::validate;
use crate::types::ValidateOptions;
use serde_json::Value;
use wasm_bindgen::prelude::*;

/// Install the console panic hook exactly once. Cheap to call on every entry.
fn set_panic_hook() {
    // console_error_panic_hook::set_once is itself idempotent.
    console_error_panic_hook::set_once();
}

/// Validate a JSON-stat document. `doc` and `options` are JS values; returns a `ValidationResult`.
#[wasm_bindgen]
pub fn validate_json(doc: JsValue, options: JsValue) -> JsValue {
    set_panic_hook();
    let docv: Value = serde_wasm_bindgen::from_value(doc).unwrap_or(Value::Null);
    let opts: ValidateOptions = serde_wasm_bindgen::from_value(options).unwrap_or_default();
    let res = validate(&docv, &opts);
    serde_wasm_bindgen::to_value(&res).unwrap_or(JsValue::NULL)
}
