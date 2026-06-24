// Helpers shared by dimension rules.
export function indexIdSet(dim: any): Set<string> | null {
  const idx = dim?.category?.index;
  if (Array.isArray(idx)) return new Set(idx.filter((x: any) => typeof x === "string"));
  if (idx && typeof idx === "object") return new Set(Object.keys(idx));
  return null; // constant dimension without index: cannot determine id set
}

/** Detects a cycle in a parent -> [child] graph. */
export function childGraphHasCycle(child: Record<string, any>): boolean {
  const adj = new Map<string, string[]>();
  const all = new Set<string>();
  for (const [p, kids] of Object.entries(child)) {
    if (!Array.isArray(kids)) continue;
    const kidsArr = kids.filter((k: any) => typeof k === "string");
    adj.set(p, kidsArr);
    all.add(p);
    for (const k of kidsArr) all.add(k);
  }
  const color = new Map<string, number>(); // 0 white, 1 gray (on stack), 2 black
  const dfs = (n: string): boolean => {
    color.set(n, 1);
    for (const m of adj.get(n) ?? []) {
      const cm = color.get(m) ?? 0;
      if (cm === 1) return true;
      if (cm === 0 && dfs(m)) return true;
    }
    color.set(n, 2);
    return false;
  };
  for (const n of all) {
    if ((color.get(n) ?? 0) === 0 && dfs(n)) return true;
  }
  return false;
}
