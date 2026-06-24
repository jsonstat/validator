// WebAssembly surface (opt-in via the `wasm` feature). Mirrors the TS validate() signature.
#![cfg(feature = "wasm")]

use crate::pipeline::validate;
use crate::types::ValidateOptions;
use serde_json::Value;
use wasm_bindgen::prelude::*;

/// Validate a JSON-stat document. `doc` and `options` are JS values; returns a `ValidationResult`.
#[wasm_bindgen]
pub fn validate_json(doc: JsValue, options: JsValue) -> JsValue {
    let docv: Value = serde_wasm_bindgen::from_value(doc).unwrap_or(Value::Null);
    let opts: ValidateOptions =
        serde_wasm_bindgen::from_value(options).unwrap_or_default();
    let res = validate(&docv, &opts);
    serde_wasm_bindgen::to_value(&res).unwrap_or(JsValue::NULL)
}
