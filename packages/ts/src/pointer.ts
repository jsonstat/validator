// Tiny RFC 6901 JSON-pointer builder.
export function ptr(...parts: Array<string | number | null | undefined>): string {
  let out = "";
  for (const p of parts) {
    if (p === null || p === undefined || p === "") continue;
    const s = String(p);
    out += "/" + s.replace(/~/g, "~0").replace(/\//g, "~1");
  }
  return out || "/";
}

/** Join a base pointer with additional segments. */
export function joinPtr(base: string, ...parts: Array<string | number>): string {
  if (base === "" || base === "/") return ptr(...parts);
  const tail = parts
    .filter((p) => p !== "" && p !== null && p !== undefined)
    .map((p) => String(p).replace(/~/g, "~0").replace(/\//g, "~1"))
    .map((s) => "/" + s)
    .join("");
  return base + tail;
}
