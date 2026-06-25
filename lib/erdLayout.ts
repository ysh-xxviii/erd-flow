import type { ErdConstraint, ErdTable, SuggestedTable } from "@/lib/types";

/** Must match EntityNode NODE_W */
export const NODE_W = 300;
const H_GAP = 80;
const V_GAP = 64;
const LAYER_GAP = 48;
const COL_SPACING = NODE_W + H_GAP;
const START_X = 80;
const START_Y = 80;
const INFRA_COLS = 5;

const HEADER_H = 42;
const DESC_H = 28;
const ROW_H = 30;
const FOOTER_ROW_H = 22;

type LayoutInput = {
  id?: string;
  name: string;
  category?: string;
  columns: ReadonlyArray<unknown>;
  description?: string;
  constraints?: ErdConstraint[];
};

function estimateHeight(t: LayoutInput): number {
  const descH = t.description?.trim() ? DESC_H : 0;
  const footerH =
    (t.constraints?.length ?? 0) > 0
      ? FOOTER_ROW_H * (t.constraints?.length ?? 0) + 4
      : 0;
  return HEADER_H + descH + t.columns.length * ROW_H + footerH;
}

type Rel = { source_table_id: string; target_table_id: string };

/** Layer tables left-to-right by FK depth (reference-style flow). */
function computeGraphLayout(
  tables: LayoutInput[],
  relationships: Rel[],
  keyBy: "id" | "name"
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const key = (t: LayoutInput) =>
    keyBy === "id" ? (t.id ?? t.name.toLowerCase()) : t.name.toLowerCase();

  const core = tables.filter((t) => (t.category ?? "core") === "core");
  const enums = tables.filter((t) => t.category === "enum");
  const upper = [...core, ...enums];

  const idSet = new Set(upper.map((t) => key(t)));
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();

  for (const r of relationships) {
    const src = r.source_table_id;
    const tgt = r.target_table_id;
    const srcKey = keyBy === "id" ? src : tables.find((t) => t.id === src)?.name.toLowerCase();
    const tgtKey = keyBy === "id" ? tgt : tables.find((t) => t.id === tgt)?.name.toLowerCase();
    if (!srcKey || !tgtKey || !idSet.has(srcKey) || !idSet.has(tgtKey)) continue;
    if (!children.has(tgtKey)) children.set(tgtKey, []);
    children.get(tgtKey)!.push(srcKey);
    hasParent.add(srcKey);
  }

  const layer = new Map<string, number>();
  const roots = upper
    .filter((t) => {
      const k = key(t);
      return t.category !== "enum" && !hasParent.has(k);
    })
    .map((t) => key(t));

  const queue = roots.map((id) => ({ id, l: 0 }));
  roots.forEach((id) => layer.set(id, 0));

  while (queue.length) {
    const { id, l } = queue.shift()!;
    for (const cid of children.get(id) ?? []) {
      const nl = l + 1;
      if (!layer.has(cid)) {
        layer.set(cid, nl);
        queue.push({ id: cid, l: nl });
      }
    }
  }

  for (const t of upper) {
    const k = key(t);
    if (!layer.has(k)) layer.set(k, 0);
  }

  for (const e of enums) {
    const ek = key(e);
    let best = layer.get(ek) ?? 0;
    for (const r of relationships) {
      const srcKey =
        keyBy === "id"
          ? r.source_table_id
          : tables.find((t) => t.id === r.source_table_id)?.name.toLowerCase();
      const tgtKey =
        keyBy === "id"
          ? r.target_table_id
          : tables.find((t) => t.id === r.target_table_id)?.name.toLowerCase();
      if (srcKey === ek && tgtKey && layer.has(tgtKey)) {
        best = Math.max(best, layer.get(tgtKey)!);
      }
      if (tgtKey === ek && srcKey && layer.has(srcKey)) {
        best = Math.max(best, layer.get(srcKey)!);
      }
    }
    layer.set(ek, best);
  }

  const byLayer = new Map<number, string[]>();
  for (const [id, l] of layer) {
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l)!.push(id);
  }

  const tableByKey = new Map(upper.map((t) => [key(t), t]));
  let y = START_Y;
  let maxCoreBottom = START_Y;

  for (const l of [...byLayer.keys()].sort((a, b) => a - b)) {
    const ids = byLayer.get(l)!;
    ids.sort((a, b) =>
      (tableByKey.get(a)?.name ?? a).localeCompare(tableByKey.get(b)?.name ?? b)
    );
    let maxH = 0;
    ids.forEach((id, i) => {
      const t = tableByKey.get(id)!;
      const h = estimateHeight(t);
      maxH = Math.max(maxH, h);
      positions.set(id, { x: START_X + i * COL_SPACING, y });
    });
    maxCoreBottom = y + maxH;
    y += maxH + V_GAP + LAYER_GAP;
  }

  const framework = tables.filter((t) => t.category === "framework");
  const infraY = maxCoreBottom + V_GAP * 2;
  framework.forEach((t, i) => {
    const h = estimateHeight(t);
    const k = key(t);
    positions.set(k, {
      x: START_X + (i % INFRA_COLS) * COL_SPACING,
      y: infraY + Math.floor(i / INFRA_COLS) * (h + V_GAP),
    });
  });

  return positions;
}

export function computeSuggestionPositions(
  suggestions: SuggestedTable[]
): Map<string, { x: number; y: number }> {
  const rels: Rel[] = [];
  const nameToKey = (n: string) => n.toLowerCase();

  for (const s of suggestions) {
    for (const r of s.relationships ?? []) {
      rels.push({
        source_table_id: nameToKey(s.name),
        target_table_id: nameToKey(r.to_table),
      });
    }
  }

  return computeGraphLayout(suggestions, rels, "name");
}

export function computeAllTablePositions(
  tables: ErdTable[],
  relationships: Rel[] = []
): Map<string, { x: number; y: number }> {
  const positions = computeGraphLayout(tables, relationships, "id");
  return positions;
}

export function computeNextTablePosition(
  existingCount: number,
  category: string = "core"
): { x: number; y: number } {
  if (category === "framework") {
    const i = existingCount;
    return {
      x: START_X + (i % INFRA_COLS) * COL_SPACING,
      y: START_Y + 700 + Math.floor(i / INFRA_COLS) * 220,
    };
  }
  return {
    x: START_X + (existingCount % 3) * COL_SPACING,
    y: START_Y + Math.floor(existingCount / 3) * 420,
  };
}

export function castConstraints(raw: unknown): ErdConstraint[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (c): c is ErdConstraint =>
        c &&
        typeof c === "object" &&
        (c.kind === "unique" || c.kind === "index") &&
        Array.isArray(c.columns)
    )
    .map((c) => ({
      kind: c.kind,
      columns: c.columns.filter((col): col is string => typeof col === "string"),
    }));
}

export function resolveTargetColId(
  columns: { id: string; name: string; is_pk: boolean }[]
): string | null {
  const pk = columns.find((c) => c.is_pk);
  if (pk) return pk.id;
  const idCol = columns.find((c) => c.name === "id");
  return idCol?.id ?? columns[0]?.id ?? null;
}

export function resolveSourceColId(
  columns: { id: string; name: string }[],
  fromColumn: string
): string | null {
  const col = columns.find(
    (c) => c.name.toLowerCase() === fromColumn.toLowerCase()
  );
  return col?.id ?? null;
}

/** Direct (1-hop) neighbors of hovered table — matches reference ERD.html */
export function computeHoverFocus(
  hoveredId: string | null,
  relationships: Rel[]
): { relatedIds: Set<string> } {
  const relatedIds = new Set<string>();
  if (!hoveredId) return { relatedIds };

  relatedIds.add(hoveredId);
  for (const r of relationships) {
    if (r.source_table_id === hoveredId) relatedIds.add(r.target_table_id);
    if (r.target_table_id === hoveredId) relatedIds.add(r.source_table_id);
  }
  return { relatedIds };
}

/** Pick handle sides so edges route toward the connected table, not through the card. */
export function resolveEdgeHandles(
  rel: {
    source_table_id: string;
    target_table_id: string;
    source_col_id: string | null;
    target_col_id: string | null;
  },
  tables: Pick<ErdTable, "id" | "pos_x">[]
): { sourceHandle: string; targetHandle: string } {
  const src = tables.find((t) => t.id === rel.source_table_id);
  const tgt = tables.find((t) => t.id === rel.target_table_id);
  const srcLeft = (src?.pos_x ?? 0) < (tgt?.pos_x ?? 0);

  if (srcLeft) {
    return {
      sourceHandle: rel.source_col_id ? `s-${rel.source_col_id}` : "s-table",
      targetHandle: rel.target_col_id ? `t-${rel.target_col_id}` : "t-table",
    };
  }
  return {
    sourceHandle: rel.source_col_id ? `s-${rel.source_col_id}-L` : "s-table-L",
    targetHandle: rel.target_col_id ? `t-${rel.target_col_id}-R` : "t-table-R",
  };
}
