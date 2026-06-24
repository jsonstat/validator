// Minimal Rust CLI demonstration: `cargo run --example validate -- <file|->`
use jsonstat_validator::{validate_from_str, ValidateOptions};
use std::io::Read;

fn main() {
    let arg = std::env::args().nth(1);
    let json = match arg.as_deref() {
        Some("-") | None => {
            let mut s = String::new();
            std::io::stdin().read_to_string(&mut s).unwrap();
            s
        }
        Some(path) => std::fs::read_to_string(path).unwrap(),
    };
    let res = validate_from_str(&json, &ValidateOptions::default());
    println!("{}", serde_json::to_string_pretty(&res).unwrap());
    std::process::exit(if res.valid { 0 } else { 1 });
}
