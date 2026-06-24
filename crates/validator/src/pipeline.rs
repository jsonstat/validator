// The validate pipeline: parse -> structural (JSON Schema) -> semantic rules -> aggregate.
use crate::engine::{analyze_dataset, run_semantic};
use crate::manifest::{lookup, manifest, ManifestData};
use crate::rules::ptr;
use crate::structural::validate_structural;
use crate::types::*;
use serde_json::Value;
use std::collections::BTreeMap;

const MAX_CELLS: u64 = 50_000_000;

pub fn validate_from_str(json: &str, options: &ValidateOptions) -> ValidationResult {
    let start = std::time::Instant::now();
    match serde_json::from_str::<Value>(json) {
        Ok(v) => validate(&v, options),
        Err(e) => {
            let mf = manifest();
            let r = lookup(&mf, "PARSE");
            let f = Finding {
                code: r.code.clone(),
                rule_id: r.id.clone(),
                severity: r.severity,
                path: "/".to_string(),
                message: format!("Input is not valid JSON: {e}"),
                expected: None,
                actual: None,
                spec_ref: r.spec_ref.clone(),
                meta: None,
            };
            finalize(vec![f], options, start)
        }
    }
}

pub fn validate(doc: &Value, options: &ValidateOptions) -> ValidationResult {
    let start = std::time::Instant::now();
    let mf = manifest();
    let ro = resolve_options(options);
    let mut findings: Vec<Finding> = Vec::new();

    let mut structural_ok = true;
    if ro.mode != "semantic" {
        let sf = validate_structural(doc, &mf);
        if !sf.is_empty() {
            structural_ok = false;
            findings.extend(sf);
        }
    }

    if ro.mode != "structural" && (ro.continue_on_structural_error || structural_ok) {
        let cls = doc["class"].as_str();
        if cls == Some("dataset") || looks_like_bundle(doc) {
            run_on_node(doc, "", options, &mf, &mut findings);
        } else if cls == Some("collection") {
            run_collection(
                doc,
                "",
                options,
                &mf,
                &mut findings,
                ro.max_collection_depth,
            );
        }
        // dimension-class responses: structural covers shape; no size context for semantic
    }

    finalize(findings, options, start)
}

fn looks_like_bundle(doc: &Value) -> bool {
    if matches!(
        doc["class"].as_str(),
        Some("dataset") | Some("collection") | Some("dimension")
    ) {
        return false;
    }
    if let Some(o) = doc.as_object() {
        for (_, v) in o {
            if v.is_object()
                && (v["class"].as_str() == Some("dataset")
                    || (v["value"].is_array() && v["id"].is_array()))
            {
                return true;
            }
        }
    }
    false
}

fn run_on_node(
    doc: &Value,
    root: &str,
    opts: &ValidateOptions,
    mf: &ManifestData,
    out: &mut Vec<Finding>,
) {
    let analyzed = analyze_dataset(doc, MAX_CELLS);
    if analyzed.overflow {
        let r = lookup(mf, "OVF");
        out.push(Finding {
            code: r.code.clone(),
            rule_id: r.id.clone(),
            severity: r.severity,
            path: ptr(root, &["size"]),
            message: format!("product(size) exceeds the cell budget ({}).", MAX_CELLS),
            expected: None,
            actual: Some(doc["size"].clone()),
            spec_ref: r.spec_ref.clone(),
            meta: None,
        });
    }
    run_semantic(doc, root, opts, mf, &analyzed, out);
}

fn run_collection(
    doc: &Value,
    root: &str,
    opts: &ValidateOptions,
    mf: &ManifestData,
    out: &mut Vec<Finding>,
    depth: usize,
) {
    let items = match doc["link"]["item"].as_array() {
        Some(a) => a,
        None => return,
    };
    if depth == 0 {
        let r = lookup(mf, "C1");
        out.push(Finding {
            code: r.code.clone(),
            rule_id: r.id.clone(),
            severity: r.severity,
            path: ptr(root, &["link", "item"]),
            message: format!(
                "Collection recursion depth exceeded (max {}); nested items not validated.",
                opts.max_collection_depth.unwrap_or(3)
            ),
            expected: None,
            actual: None,
            spec_ref: r.spec_ref.clone(),
            meta: None,
        });
        return;
    }
    for (i, item) in items.iter().enumerate() {
        if !item.is_object() {
            continue;
        }
        let i_str = i.to_string();
        let ip = ptr(root, &["link", "item", &i_str]);
        if item["class"].as_str() == Some("dataset")
            && (item.get("value").is_some() || item.get("id").is_some())
        {
            run_on_node(item, &ip, opts, mf, out);
        } else if item["class"].as_str() == Some("collection") && item.get("link").is_some() {
            run_collection(item, &ip, opts, mf, out, depth - 1);
        }
        // href-only items are not fetched by default (design D2)
    }
}

fn finalize(
    all: Vec<Finding>,
    options: &ValidateOptions,
    start: std::time::Instant,
) -> ValidationResult {
    let mf = manifest();
    let ro = resolve_options(options);
    let valid = all.iter().all(|f| f.severity != Severity::Error);
    let filtered: Vec<Finding> = all
        .into_iter()
        .filter(|f| f.severity.rank() <= ro.min_severity.rank())
        .collect();

    let mut summary = Summary {
        errors: 0,
        warnings: 0,
        infos: 0,
        structural_errors: 0,
        by_code: BTreeMap::new(),
        truncated: None,
    };
    for f in &filtered {
        match f.severity {
            Severity::Error => summary.errors += 1,
            Severity::Warning => summary.warnings += 1,
            Severity::Info => summary.infos += 1,
        }
        if f.code == "STRUCTURAL_VIOLATION" {
            summary.structural_errors += 1;
        }
        *summary.by_code.entry(f.code.clone()).or_insert(0) += 1;
    }

    let meta = ResultMeta {
        engine_version: mf.engine_version.clone(),
        rule_set_version: mf.rule_set_version.clone(),
        schema_version: mf.schema_version.clone(),
        duration_ms: start.elapsed().as_millis(),
    };

    ValidationResult {
        valid,
        findings: filtered,
        summary,
        options: ro,
        meta,
    }
}
