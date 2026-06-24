use crate::manifest::ManifestData;
use crate::rules;
use crate::types::{Finding, ValidateOptions};
use serde_json::Value;
use std::collections::HashSet;

pub struct Analyzed {
    pub id_arr: Option<Vec<String>>,
    pub size_arr: Option<Vec<i64>>,
    pub id_set: Option<HashSet<String>>,
    pub product: Option<u128>,
    pub overflow: bool,
}

/// Compute id/size arrays, the valid id set, and the safe (overflow-checked) product(size).
pub fn analyze_dataset(doc: &Value, max_cells: u64) -> Analyzed {
    let id_arr = doc["id"]
        .as_array()
        .map(|a| a.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect::<Vec<_>>());

    let id_set = id_arr.as_ref().map(|v| v.iter().cloned().collect::<HashSet<_>>());

    let size_arr = doc["size"].as_array().and_then(|a| {
        let mut out = Vec::with_capacity(a.len());
        for x in a {
            match x.as_i64() {
                Some(n) if n >= 0 => out.push(n),
                _ => return None,
            }
        }
        Some(out)
    });

    let mut overflow = false;
    let mut product: Option<u128> = None;
    if let Some(ref sizes) = size_arr {
        let mut p: u128 = 1;
        for &s in sizes {
            match p.checked_mul(s as u128) {
                Some(x) => p = x,
                None => {
                    overflow = true;
                    break;
                }
            }
            if p > max_cells as u128 {
                overflow = true;
                break;
            }
        }
        if !overflow {
            product = Some(p);
        }
    }

    Analyzed { id_arr, size_arr, id_set, product, overflow }
}

pub struct Ctx<'a> {
    pub doc: &'a Value,
    pub root: &'a str,
    pub opts: &'a ValidateOptions,
    pub mf: &'a ManifestData,
    pub analyzed: &'a Analyzed,
}

/// Run all registered rules against a dataset node, appending findings into `out`.
pub fn run_semantic(
    doc: &Value,
    root: &str,
    opts: &ValidateOptions,
    mf: &ManifestData,
    analyzed: &Analyzed,
    out: &mut Vec<Finding>,
) {
    let ctx = Ctx { doc, root, opts, mf, analyzed };
    rules::dataset_rules(&ctx, out);
    rules::dimension_rules(&ctx, out);
}
