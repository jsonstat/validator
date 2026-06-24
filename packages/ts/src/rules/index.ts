import type { Rule } from "../types.js";
import { DATASET_RULES } from "./dataset.js";
import { DIMENSION_RULES } from "./dimension.js";

// Ordering is advisory: dataset-level (S) first, then dimension-level (D). See design §3.2.
export const RULES: Rule[] = [...DATASET_RULES, ...DIMENSION_RULES];
