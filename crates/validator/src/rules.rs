// Semantic rules: the cross-field cube invariants JSON Schema cannot express.
// Hand-written, mirroring the TypeScript surface (packages/ts/src/rules/*); the shared
// conformance corpus (corpus/cases.json) is the behavioural parity gate between the two.
use crate::engine::Ctx;
use crate::manifest::lookup;
use crate::types::Finding;
use serde_json::Value;
use std::collections::{HashMap, HashSet};

pub(crate) fn esc(s: &str) -> String {
    s.replace('~', "~0").replace('/', "~1")
}

/// Build an RFC 6901 JSON pointer from a base and escaped segments.
pub(crate) fn ptr(base: &str, segs: &[&str]) -> String {
    let mut s = if base.is_empty() {
        String::new()
    } else {
        base.to_string()
    };
    for seg in segs {
        s.push('/');
        s.push_str(&esc(seg));
    }
    if s.is_empty() {
        "/".to_string()
    } else {
        s
    }
}

fn emit(
    c: &Ctx,
    out: &mut Vec<Finding>,
    id: &str,
    path: String,
    message: String,
    expected: Option<Value>,
    actual: Option<Value>,
) {
    let r = lookup(c.mf, id);
    out.push(Finding {
        code: r.code.clone(),
        rule_id: r.id.clone(),
        severity: r.severity,
        path,
        message,
        expected,
        actual,
        spec_ref: r.spec_ref.clone(),
        meta: None,
    });
}

pub fn dataset_rules(c: &Ctx, out: &mut Vec<Finding>) {
    s1(c, out);
    s2(c, out);
    s3(c, out);
    s4(c, out);
    s5(c, out);
    s6(c, out);
    s7(c, out);
    s8(c, out);
    c2(c, out);
}

pub fn dimension_rules(c: &Ctx, out: &mut Vec<Finding>) {
    let id = match &c.analyzed.id_arr {
        Some(v) => v,
        None => return,
    };
    let dims = match c.doc["dimension"].as_object() {
        Some(o) => o,
        None => return,
    };
    for (i, dim_id) in id.iter().enumerate() {
        let dim = match dims.get(dim_id) {
            Some(d) => d,
            None => continue,
        };
        if !dim.is_object() {
            continue;
        }
        let size = c.analyzed.size_arr.as_ref().and_then(|s| s.get(i).copied());
        d1(c, dim_id, dim, size, out);
        d2(c, dim_id, dim, size, out);
        d3a(c, dim_id, dim, out);
        d4(c, dim_id, dim, out);
        d5(c, dim_id, dim, out);
        d6(c, dim_id, dim, out);
        d7a(c, dim_id, dim, out);
        d7b(c, dim_id, dim, out);
    }
}

fn s1(c: &Ctx, out: &mut Vec<Finding>) {
    if let (Some(id), Some(sz)) = (&c.analyzed.id_arr, &c.analyzed.size_arr) {
        if id.len() != sz.len() {
            emit(
                c,
                out,
                "S1",
                ptr(c.root, &["id"]),
                format!(
                    "'id' has {} entries but 'size' has {}; they must be equal.",
                    id.len(),
                    sz.len()
                ),
                Some(serde_json::json!(sz.len())),
                Some(serde_json::json!(id.len())),
            );
        }
    }
}

fn s2(c: &Ctx, out: &mut Vec<Finding>) {
    let id = match &c.analyzed.id_arr {
        Some(v) => v.clone(),
        None => return,
    };
    let dims = match c.doc["dimension"].as_object() {
        Some(o) => o,
        None => return,
    };
    let dim_keys: Vec<String> = dims.keys().cloned().collect();
    let id_set = match &c.analyzed.id_set {
        Some(s) => s,
        None => return,
    };
    let missing: Vec<&String> = id
        .iter()
        .filter(|x| !dims.contains_key(x.as_str()))
        .collect();
    let extra: Vec<&String> = dim_keys
        .iter()
        .filter(|k| !id_set.contains(k.as_str()))
        .collect();
    if !missing.is_empty() || !extra.is_empty() {
        emit(c, out, "S2", ptr(c.root, &["dimension"]),
            format!("'dimension' keys and 'id' values differ. In 'id' but not 'dimension': [{}]. In 'dimension' but not 'id': [{}].",
                missing.iter().map(|s| s.as_str()).collect::<Vec<_>>().join(", "),
                extra.iter().map(|s| s.as_str()).collect::<Vec<_>>().join(", ")),
            Some(serde_json::json!(id)), Some(serde_json::json!(dim_keys)));
    }
}

fn s3(c: &Ctx, out: &mut Vec<Finding>) {
    if c.analyzed.overflow || c.analyzed.product.is_none() {
        return;
    }
    let v = match c.doc["value"].as_array() {
        Some(a) => a,
        None => return,
    };
    let prod = c.analyzed.product.unwrap();
    if v.len() as u128 != prod {
        emit(
            c,
            out,
            "S3",
            ptr(c.root, &["value"]),
            format!(
                "Dense 'value' length {} must equal product(size) = {}.",
                v.len(),
                prod
            ),
            Some(serde_json::json!(prod.to_string())),
            Some(serde_json::json!(v.len())),
        );
    }
}

fn s4(c: &Ctx, out: &mut Vec<Finding>) {
    if c.analyzed.overflow {
        return;
    }
    let prod = match c.analyzed.product {
        Some(p) => p,
        None => return,
    };
    let v = match c.doc["value"].as_object() {
        Some(o) => o,
        None => return,
    };
    let max = prod - 1;
    for (k, _) in v {
        let bad = match k.parse::<u128>() {
            Ok(n) => n > max,
            Err(_) => true,
        };
        if bad {
            emit(
                c,
                out,
                "S4",
                ptr(c.root, &["value", k]),
                format!("Sparse 'value' key '{}' is out of range [0, {}].", k, max),
                Some(serde_json::json!(format!("[0, {}]", max))),
                Some(serde_json::json!(k)),
            );
        }
    }
}

fn s5(c: &Ctx, out: &mut Vec<Finding>) {
    let id_set = match &c.analyzed.id_set {
        Some(s) => s,
        None => return,
    };
    let role = match c.doc["role"].as_object() {
        Some(o) => o,
        None => return,
    };
    for r in ["time", "geo", "metric"] {
        if let Some(arr) = role.get(r).and_then(|v| v.as_array()) {
            for id in arr {
                if let Some(s) = id.as_str() {
                    if !id_set.contains(s) {
                        emit(
                            c,
                            out,
                            "S5",
                            ptr(c.root, &["role", r]),
                            format!("role.{} references unknown dimension id '{}'.", r, s),
                            Some(serde_json::json!(id_set
                                .iter()
                                .cloned()
                                .collect::<Vec<_>>())),
                            Some(serde_json::json!(s)),
                        );
                    }
                }
            }
        }
    }
}

fn s6(c: &Ctx, out: &mut Vec<Finding>) {
    if c.analyzed.overflow {
        return;
    }
    let prod = match c.analyzed.product {
        Some(p) => p,
        None => return,
    };
    let s = match c.doc["status"].as_array() {
        Some(a) => a,
        None => return,
    };
    if s.len() as u128 != prod {
        emit(
            c,
            out,
            "S6",
            ptr(c.root, &["status"]),
            format!(
                "Array 'status' length {} must equal product(size) = {}.",
                s.len(),
                prod
            ),
            Some(serde_json::json!(prod.to_string())),
            Some(serde_json::json!(s.len())),
        );
    }
}

fn s7(c: &Ctx, out: &mut Vec<Finding>) {
    if c.analyzed.overflow {
        return;
    }
    let prod = match c.analyzed.product {
        Some(p) => p,
        None => return,
    };
    let s = match c.doc["status"].as_object() {
        Some(o) => o,
        None => return,
    };
    let max = prod - 1;
    for (k, _) in s {
        let bad = match k.parse::<u128>() {
            Ok(n) => n > max,
            Err(_) => true,
        };
        if bad {
            emit(
                c,
                out,
                "S7",
                ptr(c.root, &["status", k]),
                format!("Object 'status' key '{}' is out of range [0, {}].", k, max),
                Some(serde_json::json!(format!("[0, {}]", max))),
                Some(serde_json::json!(k)),
            );
        }
    }
}

fn s8(c: &Ctx, out: &mut Vec<Finding>) {
    let id_set = match &c.analyzed.id_set {
        Some(s) => s,
        None => return,
    };
    let metric = match c.doc["role"]["metric"].as_array() {
        Some(a) => a,
        None => return,
    };
    for id in metric {
        let s = match id.as_str() {
            Some(x) => x,
            None => continue,
        };
        if !id_set.contains(s) {
            continue;
        }
        let unit = &c.doc["dimension"][s]["category"]["unit"];
        let empty = !unit.is_object() || unit.as_object().is_none_or(|o| o.is_empty());
        if empty {
            emit(
                c,
                out,
                "S8",
                ptr(c.root, &["dimension", s, "category", "unit"]),
                format!("Metric dimension '{}' has no category.unit.", s),
                Some(serde_json::json!("non-empty unit object")),
                Some(serde_json::json!(if unit.is_object() {
                    "empty"
                } else {
                    "missing"
                })),
            );
        }
    }
}

fn c2(c: &Ctx, out: &mut Vec<Finding>) {
    let d = c.doc;
    if matches!(
        d["class"].as_str(),
        Some("dataset") | Some("collection") | Some("dimension")
    ) {
        return;
    }
    let mut bundle = false;
    if let Some(obj) = d.as_object() {
        for (_, v) in obj {
            if v.is_object()
                && (v["class"].as_str() == Some("dataset")
                    || (v["value"].is_array() && v["id"].is_array()))
            {
                bundle = true;
                break;
            }
        }
    }
    if bundle {
        let p = if c.root.is_empty() {
            "/".to_string()
        } else {
            c.root.to_string()
        };
        emit(c, out, "C2", p,
            "Response looks like a pre-2.0 bundle (root maps dataset IDs to datasets). Bundles are deprecated; use the 'collection' class.".to_string(),
            None, None);
    }
}

fn index_id_set(dim: &Value) -> Option<Vec<String>> {
    let idx = &dim["category"]["index"];
    if let Some(arr) = idx.as_array() {
        Some(
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect(),
        )
    } else {
        idx.as_object().map(|o| o.keys().cloned().collect())
    }
}

fn d1(c: &Ctx, dim_id: &str, dim: &Value, size: Option<i64>, out: &mut Vec<Finding>) {
    let idx = match dim["category"]["index"].as_array() {
        Some(a) => a,
        None => return,
    };
    let s = match size {
        Some(n) => n,
        None => return,
    };
    if idx.len() as i64 != s {
        emit(
            c,
            out,
            "D1",
            ptr(c.root, &["dimension", dim_id, "category", "index"]),
            format!(
                "Dimension '{}' index has {} categories but size is {}.",
                dim_id,
                idx.len(),
                s
            ),
            Some(serde_json::json!(s)),
            Some(serde_json::json!(idx.len())),
        );
    }
}

fn d2(c: &Ctx, dim_id: &str, dim: &Value, size: Option<i64>, out: &mut Vec<Finding>) {
    let idx = match dim["category"]["index"].as_object() {
        Some(o) => o,
        None => return,
    };
    let s = match size {
        Some(n) => n,
        None => return,
    };
    let vals: Vec<i64> = idx.values().filter_map(|v| v.as_i64()).collect();
    let mut ok = vals.len() == s as usize;
    if ok {
        let set: HashSet<i64> = vals.iter().copied().collect();
        ok = (0..s).all(|i| set.contains(&i));
    }
    if !ok {
        emit(
            c,
            out,
            "D2",
            ptr(c.root, &["dimension", dim_id, "category", "index"]),
            format!(
                "Dimension '{}' index positions are not a permutation of [0, {}].",
                dim_id,
                s - 1
            ),
            Some(serde_json::json!(format!("[0..{}]", s - 1))),
            Some(serde_json::json!(vals)),
        );
    }
}

fn d3a(c: &Ctx, dim_id: &str, dim: &Value, out: &mut Vec<Finding>) {
    let label = match dim["category"]["label"].as_object() {
        Some(o) => o,
        None => return,
    };
    let ids = match index_id_set(dim) {
        Some(v) => v,
        None => return,
    };
    let unknown: Vec<String> = label.keys().filter(|k| !ids.contains(k)).cloned().collect();
    if !unknown.is_empty() {
        emit(
            c,
            out,
            "D3a",
            ptr(c.root, &["dimension", dim_id, "category", "label"]),
            format!(
                "Dimension '{}' label has unknown category ids: [{}].",
                dim_id,
                unknown.join(", ")
            ),
            Some(serde_json::json!(ids)),
            Some(serde_json::json!(label.keys().cloned().collect::<Vec<_>>())),
        );
        return;
    }
    let missing: Vec<String> = ids
        .iter()
        .filter(|id| !label.contains_key(id.as_str()))
        .cloned()
        .collect();
    if !missing.is_empty() {
        emit(
            c,
            out,
            "D3b",
            ptr(c.root, &["dimension", dim_id, "category", "label"]),
            format!(
                "Dimension '{}' label is missing categories: [{}].",
                dim_id,
                missing.join(", ")
            ),
            Some(serde_json::json!(ids)),
            Some(serde_json::json!(label.keys().cloned().collect::<Vec<_>>())),
        );
    }
}

fn unknown_keys(
    c: &Ctx,
    dim_id: &str,
    dim: &Value,
    prop: &str,
    code: &str,
    label: &str,
    out: &mut Vec<Finding>,
) {
    let map = match dim["category"][prop].as_object() {
        Some(o) => o,
        None => return,
    };
    let ids = match index_id_set(dim) {
        Some(v) => v,
        None => return,
    };
    let unknown: Vec<String> = map.keys().filter(|k| !ids.contains(k)).cloned().collect();
    if !unknown.is_empty() {
        emit(
            c,
            out,
            code,
            ptr(c.root, &["dimension", dim_id, "category", prop]),
            format!(
                "Dimension '{}' {} has unknown category ids: [{}].",
                dim_id,
                label,
                unknown.join(", ")
            ),
            Some(serde_json::json!(ids)),
            Some(serde_json::json!(map.keys().cloned().collect::<Vec<_>>())),
        );
    }
}

fn d4(c: &Ctx, dim_id: &str, dim: &Value, out: &mut Vec<Finding>) {
    unknown_keys(c, dim_id, dim, "unit", "D4", "unit", out);
}
fn d5(c: &Ctx, dim_id: &str, dim: &Value, out: &mut Vec<Finding>) {
    unknown_keys(c, dim_id, dim, "coordinates", "D5", "coordinates", out);
}
fn d6(c: &Ctx, dim_id: &str, dim: &Value, out: &mut Vec<Finding>) {
    unknown_keys(c, dim_id, dim, "note", "D6", "note", out);
}

fn d7a(c: &Ctx, dim_id: &str, dim: &Value, out: &mut Vec<Finding>) {
    let child = match dim["category"]["child"].as_object() {
        Some(o) => o,
        None => return,
    };
    let ids = match index_id_set(dim) {
        Some(v) => v,
        None => return,
    };
    let mut bad: Vec<String> = Vec::new();
    for (p, kids) in child {
        if !ids.contains(p) {
            bad.push(p.clone());
        }
        if let Some(arr) = kids.as_array() {
            for k in arr {
                if let Some(s) = k.as_str() {
                    if !ids.iter().any(|x| x == s) {
                        bad.push(s.to_string());
                    }
                }
            }
        }
    }
    if !bad.is_empty() {
        bad.sort();
        bad.dedup();
        emit(
            c,
            out,
            "D7a",
            ptr(c.root, &["dimension", dim_id, "category", "child"]),
            format!(
                "Dimension '{}' child references unknown category ids: [{}].",
                dim_id,
                bad.join(", ")
            ),
            Some(serde_json::json!(ids)),
            Some(serde_json::json!(bad)),
        );
    }
}

fn child_has_cycle(child: &serde_json::Map<String, Value>) -> bool {
    let mut adj: HashMap<String, Vec<String>> = HashMap::new();
    let mut all: HashSet<String> = HashSet::new();
    for (p, kids) in child {
        let arr: Vec<String> = kids
            .as_array()
            .map(|a| {
                a.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default();
        all.insert(p.clone());
        for k in &arr {
            all.insert(k.clone());
        }
        adj.insert(p.clone(), arr);
    }
    let mut color: HashMap<String, u8> = HashMap::new();
    fn dfs(n: &str, adj: &HashMap<String, Vec<String>>, color: &mut HashMap<String, u8>) -> bool {
        color.insert(n.to_string(), 1);
        if let Some(neigh) = adj.get(n) {
            for m in neigh {
                let cm = *color.get(m).unwrap_or(&0);
                if cm == 1 {
                    return true;
                }
                if cm == 0 && dfs(m, adj, color) {
                    return true;
                }
            }
        }
        color.insert(n.to_string(), 2);
        false
    }
    for n in all {
        if *color.get(&n).unwrap_or(&0) == 0 && dfs(&n, &adj, &mut color) {
            return true;
        }
    }
    false
}

fn d7b(c: &Ctx, dim_id: &str, dim: &Value, out: &mut Vec<Finding>) {
    let child = match dim["category"]["child"].as_object() {
        Some(o) => o,
        None => return,
    };
    if child_has_cycle(child) {
        emit(
            c,
            out,
            "D7b",
            ptr(c.root, &["dimension", dim_id, "category", "child"]),
            format!("Dimension '{}' child hierarchy contains a cycle.", dim_id),
            None,
            None,
        );
    }
}
