// Parity gate: the Rust surface must satisfy the SAME shared corpus (corpus/cases.json) the
// TypeScript suite asserts against. This is what makes the hand-written two-language rules safe.
use jsonstat_validator::{validate_from_str, Severity, ValidateOptions};
use serde::Deserialize;
use serde_json::Value;

#[derive(Deserialize)]
struct Case {
    id: String,
    group: String,
    input: Value,
    expected: Expected,
}

#[derive(Deserialize, Default)]
struct Expected {
    codes: Option<Vec<String>>,
    valid: Option<bool>,
    #[serde(rename = "noOtherErrors")]
    no_other_errors: Option<bool>,
}

#[test]
fn corpus_parity() {
    let path = format!("{}/../../corpus/cases.json", env!("CARGO_MANIFEST_DIR"));
    let txt = std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("could not read corpus at {path}: {e}"));
    let cases: Vec<Case> = serde_json::from_str(&txt).expect("corpus/cases.json must parse");

    let opts = ValidateOptions::default();
    let mut failures: Vec<String> = Vec::new();

    for c in &cases {
        let json = serde_json::to_string(&c.input).unwrap();
        let res = validate_from_str(&json, &opts);
        let codes: Vec<String> = res.findings.iter().map(|f| f.code.clone()).collect();

        if c.group == "valid" {
            if !res.valid {
                failures.push(format!("{}: expected valid, got [{}]", c.id, codes.join(", ")));
            }
            for f in &res.findings {
                if f.severity == Severity::Error {
                    failures.push(format!("{}: unexpected error {}", c.id, f.code));
                }
            }
        } else {
            let exp = c.expected.codes.clone().unwrap_or_default();
            for code in &exp {
                if !codes.contains(code) {
                    failures.push(format!("{}: expected code {} in [{}]", c.id, code, codes.join(",")));
                }
            }
            if c.expected.no_other_errors.unwrap_or(true) {
                for f in &res.findings {
                    if f.severity == Severity::Error && !exp.contains(&f.code) {
                        failures.push(format!("{}: unexpected error {}", c.id, f.code));
                    }
                }
            }
            if let Some(v) = c.expected.valid {
                if res.valid != v {
                    failures.push(format!("{}: valid mismatch (expected {})", c.id, v));
                }
            }
        }
    }

    assert!(
        failures.is_empty(),
        "corpus parity failures ({}):\n{}",
        failures.len(),
        failures.join("\n")
    );
}
