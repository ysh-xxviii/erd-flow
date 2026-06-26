import type { ApiRequest, ErdRelationship, ErdTable } from "@/lib/types";

/** Strip variables and return the path portion of a request URL. */
function stripUrlToPath(url: string): string {
  let path = url.replace(/\{\{[^}]+\}\}/g, "").trim();
  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      path = new URL(path).pathname;
    } catch {
      /* keep as-is */
    }
  }
  return path;
}

/** Match a path segment to a table name (tolerate simple plural/singular). */
function segmentMatchesTable(segment: string, tableName: string): boolean {
  const s = segment.toLowerCase();
  const t = tableName.toLowerCase();
  if (s === t) return true;
  if (s === `${t}s` || `${s}s` === t) return true;
  if (s.endsWith("ies") && t === `${s.slice(0, -3)}y`) return true;
  if (t.endsWith("ies") && s === `${t.slice(0, -3)}y`) return true;
  return false;
}

/** Table names referenced in order along an endpoint path (nested routes). */
export function endpointTableNames(
  url: string,
  tableNames: string[]
): string[] {
  const path = stripUrlToPath(url);
  const segments = path.split("/").filter((seg) => {
    if (!seg) return false;
    if (seg.startsWith(":")) return false;
    if (/^\{\{/.test(seg)) return false;
    return true;
  });

  const matched: string[] = [];
  const seen = new Set<string>();
  for (const seg of segments) {
    for (const name of tableNames) {
      const key = name.toLowerCase();
      if (segmentMatchesTable(seg, name) && !seen.has(key)) {
        seen.add(key);
        matched.push(name);
        break;
      }
    }
  }
  return matched;
}

/** Map relationship id -> API requests whose paths span both connected tables. */
export function buildEdgeEndpointMap(
  requests: ApiRequest[],
  relationships: ErdRelationship[],
  tables: ErdTable[]
): Record<string, ApiRequest[]> {
  const tableById = new Map(tables.map((t) => [t.id, t]));
  const tableNames = tables.map((t) => t.name);
  const map: Record<string, ApiRequest[]> = {};

  for (const rel of relationships) {
    const src = tableById.get(rel.source_table_id);
    const tgt = tableById.get(rel.target_table_id);
    if (!src || !tgt) continue;

    const pair = new Set([src.name.toLowerCase(), tgt.name.toLowerCase()]);

    for (const req of requests) {
      const matched = endpointTableNames(req.url, tableNames);
      if (matched.length < 2) continue;

      const matchedSet = new Set(matched.map((n) => n.toLowerCase()));
      const spansPair = [...pair].every((n) => matchedSet.has(n));
      if (!spansPair) continue;

      if (!map[rel.id]) map[rel.id] = [];
      if (!map[rel.id].some((r) => r.id === req.id)) {
        map[rel.id].push(req);
      }
    }
  }

  return map;
}
