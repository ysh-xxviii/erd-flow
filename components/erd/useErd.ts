"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  castConstraints,
  computeAllTablePositions,
  computeNextTablePosition,
  computeSuggestionPositions,
  resolveSourceColId,
  resolveTargetColId,
} from "@/lib/erdLayout";
import {
  fetchJsonShapeFromAi,
  needsJsonShapeGeneration,
  type JsonShapeAiResult,
} from "@/lib/jsonShapeAi";
import { isJsonColumn } from "@/lib/jsonShapes";
import {
  ACCENT_ORDER,
  type AccentColor,
  type Cardinality,
  type ErdColumn,
  type ErdConstraint,
  type ErdRelationship,
  type ErdTable,
  type SuggestedTable,
  type TableCategory,
} from "@/lib/types";

const DEFAULT_TYPES = ["uuid", "text", "integer", "boolean", "timestamptz"];
export const COLUMN_TYPES = [
  "uuid",
  "text",
  "varchar",
  "integer",
  "bigint",
  "numeric",
  "boolean",
  "date",
  "timestamptz",
  "json",
  "jsonb",
];

function castColor(c: string): AccentColor {
  return (ACCENT_ORDER as string[]).includes(c)
    ? (c as AccentColor)
    : "blue";
}

function castCategory(c: unknown): TableCategory {
  return c === "framework" || c === "enum" ? c : "core";
}

function mapTableRow(
  data: Record<string, unknown>,
  columns: ErdColumn[],
  diagramId: string
): ErdTable {
  return {
    id: data.id as string,
    diagram_id: diagramId,
    name: data.name as string,
    color: castColor(data.color as string),
    category: castCategory(data.category),
    description: (data.description as string) ?? "",
    constraints: castConstraints(data.constraints),
    pos_x: data.pos_x as number,
    pos_y: data.pos_y as number,
    columns,
  };
}

export function useErd(
  diagramId: string,
  initialTables: ErdTable[],
  initialRelationships: ErdRelationship[]
) {
  const supabase = useMemo(() => createClient(), []);
  const [tables, setTables] = useState<ErdTable[]>(initialTables);
  const [relationships, setRelationships] = useState<ErdRelationship[]>(
    initialRelationships
  );
  const [saving, setSaving] = useState(false);
  const posTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const nextColor = useCallback((): AccentColor => {
    return ACCENT_ORDER[tables.length % ACCENT_ORDER.length];
  }, [tables.length]);

  const addTable = useCallback(
    async (
      name: string,
      pos?: { x: number; y: number },
      category: TableCategory = "core"
    ) => {
      const color = nextColor();
      const position =
        pos ??
        computeNextTablePosition(tables.length, category);
      setSaving(true);
      const { data, error } = await supabase
        .from("erd_tables")
        .insert({
          diagram_id: diagramId,
          name,
          color,
          category,
          description: "",
          constraints: [],
          pos_x: position.x,
          pos_y: position.y,
        })
        .select("*")
        .single();
      if (error || !data) {
        setSaving(false);
        throw new Error(error?.message);
      }

      const { data: col } = await supabase
        .from("erd_columns")
        .insert({
          table_id: data.id,
          name: "id",
          data_type: "uuid",
          is_pk: true,
          is_nullable: false,
          ordinal: 0,
        })
        .select("*")
        .single();

      const newTable = mapTableRow(
        data,
        col ? [col as ErdColumn] : [],
        diagramId
      );
      setTables((t) => [...t, newTable]);
      setSaving(false);
      return newTable;
    },
    [diagramId, nextColor, supabase, tables.length]
  );

  const renameTable = useCallback(
    async (id: string, name: string) => {
      setTables((t) => t.map((tb) => (tb.id === id ? { ...tb, name } : tb)));
      await supabase.from("erd_tables").update({ name }).eq("id", id);
    },
    [supabase]
  );

  const setTableColor = useCallback(
    async (id: string, color: AccentColor) => {
      setTables((t) =>
        t.map((tb) => (tb.id === id ? { ...tb, color } : tb))
      );
      await supabase.from("erd_tables").update({ color }).eq("id", id);
    },
    [supabase]
  );

  const updateTableMeta = useCallback(
    async (
      id: string,
      patch: { description?: string; constraints?: ErdConstraint[] }
    ) => {
      setTables((t) =>
        t.map((tb) => (tb.id === id ? { ...tb, ...patch } : tb))
      );
      const dbPatch: Record<string, unknown> = {};
      if (patch.description !== undefined)
        dbPatch.description = patch.description;
      if (patch.constraints !== undefined)
        dbPatch.constraints = patch.constraints;
      await supabase.from("erd_tables").update(dbPatch).eq("id", id);
    },
    [supabase]
  );

  const moveTable = useCallback(
    (id: string, x: number, y: number) => {
      setTables((t) =>
        t.map((tb) => (tb.id === id ? { ...tb, pos_x: x, pos_y: y } : tb))
      );
      clearTimeout(posTimers.current[id]);
      posTimers.current[id] = setTimeout(() => {
        supabase
          .from("erd_tables")
          .update({ pos_x: x, pos_y: y })
          .eq("id", id);
      }, 400);
    },
    [supabase]
  );

  const deleteTable = useCallback(
    async (id: string) => {
      setTables((t) => t.filter((tb) => tb.id !== id));
      setRelationships((r) =>
        r.filter((rel) => rel.source_table_id !== id && rel.target_table_id !== id)
      );
      await supabase.from("erd_tables").delete().eq("id", id);
    },
    [supabase]
  );

  const addColumn = useCallback(
    async (tableId: string) => {
      const table = tables.find((t) => t.id === tableId);
      const ordinal = table ? table.columns.length : 0;
      const { data } = await supabase
        .from("erd_columns")
        .insert({
          table_id: tableId,
          name: `column_${ordinal + 1}`,
          data_type: "text",
          ordinal,
        })
        .select("*")
        .single();
      if (!data) return;
      setTables((t) =>
        t.map((tb) =>
          tb.id === tableId
            ? { ...tb, columns: [...tb.columns, data as ErdColumn] }
            : tb
        )
      );
    },
    [supabase, tables]
  );

  const applyJsonShapeToColumn = useCallback(
    async (tableId: string, colId: string, result: JsonShapeAiResult) => {
      const patch = {
        json_description: result.json_description,
        json_schema: result.json_schema,
      };
      setTables((t) =>
        t.map((tb) =>
          tb.id === tableId
            ? {
                ...tb,
                columns: tb.columns.map((c) =>
                  c.id === colId ? { ...c, ...patch } : c
                ),
              }
            : tb
        )
      );
      await supabase.from("erd_columns").update(patch).eq("id", colId);
    },
    [supabase]
  );

  const generateJsonShape = useCallback(
    async (
      tableId: string,
      colId: string,
      options?: { force?: boolean }
    ) => {
      const table = tables.find((t) => t.id === tableId);
      const col = table?.columns.find((c) => c.id === colId);
      if (!table || !col || !isJsonColumn(col)) return;
      if (!options?.force && !needsJsonShapeGeneration(col)) return;

      const result = await fetchJsonShapeFromAi({
        tableName: table.name,
        columnName: col.name,
        tableDescription: table.description,
        siblingColumns: table.columns
          .filter((c) => c.id !== colId)
          .map((c) => ({ name: c.name, data_type: c.data_type })),
      });
      await applyJsonShapeToColumn(tableId, colId, result);
    },
    [applyJsonShapeToColumn, tables]
  );

  const updateColumn = useCallback(
    async (
      tableId: string,
      colId: string,
      patch: Partial<Omit<ErdColumn, "id" | "table_id">>
    ) => {
      const table = tables.find((t) => t.id === tableId);
      const existing = table?.columns.find((c) => c.id === colId);
      const merged = existing ? { ...existing, ...patch } : null;

      setTables((t) =>
        t.map((tb) =>
          tb.id === tableId
            ? {
                ...tb,
                columns: tb.columns.map((c) =>
                  c.id === colId ? { ...c, ...patch } : c
                ),
              }
            : tb
        )
      );
      await supabase.from("erd_columns").update(patch).eq("id", colId);

      if (
        table &&
        merged &&
        isJsonColumn(merged) &&
        needsJsonShapeGeneration(merged)
      ) {
        void generateJsonShape(tableId, colId).catch(() => {});
      }
    },
    [generateJsonShape, supabase, tables]
  );

  const deleteColumn = useCallback(
    async (tableId: string, colId: string) => {
      setTables((t) =>
        t.map((tb) =>
          tb.id === tableId
            ? { ...tb, columns: tb.columns.filter((c) => c.id !== colId) }
            : tb
        )
      );
      setRelationships((r) =>
        r.filter(
          (rel) => rel.source_col_id !== colId && rel.target_col_id !== colId
        )
      );
      await supabase.from("erd_columns").delete().eq("id", colId);
    },
    [supabase]
  );

  const addRelationship = useCallback(
    async (rel: {
      source_table_id: string;
      target_table_id: string;
      cardinality?: Cardinality;
      source_col_id?: string | null;
      target_col_id?: string | null;
    }) => {
      if (rel.source_table_id === rel.target_table_id) return;
      const { data } = await supabase
        .from("erd_relationships")
        .insert({
          diagram_id: diagramId,
          source_table_id: rel.source_table_id,
          target_table_id: rel.target_table_id,
          source_col_id: rel.source_col_id ?? null,
          target_col_id: rel.target_col_id ?? null,
          cardinality: rel.cardinality ?? "one-to-many",
        })
        .select("*")
        .single();
      if (!data) return;
      setRelationships((r) => [...r, data as ErdRelationship]);
    },
    [diagramId, supabase]
  );

  const deleteRelationship = useCallback(
    async (id: string) => {
      setRelationships((r) => r.filter((rel) => rel.id !== id));
      await supabase.from("erd_relationships").delete().eq("id", id);
    },
    [supabase]
  );

  const applySuggestions = useCallback(
    async (suggestions: SuggestedTable[]) => {
      setSaving(true);
      const nameToId = new Map<string, string>();
      tables.forEach((t) => nameToId.set(t.name.toLowerCase(), t.id));

      const positions = computeSuggestionPositions(suggestions);
      const createdTables: ErdTable[] = [];
      const tableColumns = new Map<string, ErdColumn[]>();
      let colorIndex = tables.length;

      for (const s of suggestions) {
        const category = castCategory(s.category);
        const color = ACCENT_ORDER[colorIndex % ACCENT_ORDER.length];
        colorIndex += 1;
        const position =
          positions.get(s.name.toLowerCase()) ??
          computeNextTablePosition(colorIndex, category);
        const constraints = s.constraints ?? [];

        const { data: tbl } = await supabase
          .from("erd_tables")
          .insert({
            diagram_id: diagramId,
            name: s.name,
            color,
            category,
            description: s.description ?? "",
            constraints,
            pos_x: position.x,
            pos_y: position.y,
          })
          .select("*")
          .single();
        if (!tbl) continue;

        const cols: ErdColumn[] = [];
        let ord = 0;
        for (const c of s.columns) {
          const { data: col } = await supabase
            .from("erd_columns")
            .insert({
              table_id: tbl.id,
              name: c.name,
              data_type: c.data_type || "text",
              is_pk: !!c.is_pk,
              is_fk: !!c.is_fk,
              is_nullable: c.is_nullable ?? true,
              default_value: c.default_value ?? null,
              label: c.label ?? null,
              json_description: c.json_description ?? null,
              json_schema: c.json_schema ?? null,
              ordinal: ord++,
            })
            .select("*")
            .single();
          if (col) cols.push(col as ErdColumn);
        }

        const newTable = mapTableRow(tbl, cols, diagramId);
        createdTables.push(newTable);
        tableColumns.set(tbl.id, cols);
        nameToId.set(s.name.toLowerCase(), tbl.id);
      }

      const newRels: ErdRelationship[] = [];
      const allTables = [...tables, ...createdTables];

      for (const s of suggestions) {
        const fromId = nameToId.get(s.name.toLowerCase());
        if (!fromId || !s.relationships) continue;

        const sourceCols =
          tableColumns.get(fromId) ??
          allTables.find((t) => t.id === fromId)?.columns ??
          [];

        for (const r of s.relationships) {
          const toId = nameToId.get(r.to_table.toLowerCase());
          if (!toId || fromId === toId) continue;

          const targetCols =
            tableColumns.get(toId) ??
            allTables.find((t) => t.id === toId)?.columns ??
            [];

          const sourceColId = resolveSourceColId(sourceCols, r.from_column);
          const targetColId = resolveTargetColId(targetCols);

          const { data } = await supabase
            .from("erd_relationships")
            .insert({
              diagram_id: diagramId,
              source_table_id: fromId,
              target_table_id: toId,
              source_col_id: sourceColId,
              target_col_id: targetColId,
              cardinality: r.cardinality || "one-to-many",
            })
            .select("*")
            .single();
          if (data) newRels.push(data as ErdRelationship);
        }
      }

      const finalRels = [...relationships, ...newRels];
      const layoutPos = computeAllTablePositions(allTables, finalRels);

      const positioned = allTables.map((t) => {
        const pos = layoutPos.get(t.id);
        if (!pos) return t;
        void supabase
          .from("erd_tables")
          .update({ pos_x: pos.x, pos_y: pos.y })
          .eq("id", t.id);
        return { ...t, pos_x: pos.x, pos_y: pos.y };
      });

      setTables(positioned);
      if (newRels.length) setRelationships((r) => [...r, ...newRels]);

      const jsonShapeJobs: Promise<void>[] = [];
      for (const t of createdTables) {
        for (const c of t.columns) {
          if (!needsJsonShapeGeneration(c)) continue;
          jsonShapeJobs.push(
            fetchJsonShapeFromAi({
              tableName: t.name,
              columnName: c.name,
              tableDescription: t.description,
              siblingColumns: t.columns
                .filter((x) => x.id !== c.id)
                .map((x) => ({ name: x.name, data_type: x.data_type })),
            })
              .then((result) => applyJsonShapeToColumn(t.id, c.id, result))
              .catch(() => {})
          );
        }
      }
      if (jsonShapeJobs.length) await Promise.all(jsonShapeJobs);

      setSaving(false);
    },
    [applyJsonShapeToColumn, diagramId, supabase, tables, relationships]
  );

  const relayoutAllTables = useCallback(async () => {
    setSaving(true);
    const positions = computeAllTablePositions(tables, relationships);

    setTables((prev) =>
      prev.map((t) => {
        const pos = positions.get(t.id);
        if (!pos) return t;
        void supabase
          .from("erd_tables")
          .update({ pos_x: pos.x, pos_y: pos.y })
          .eq("id", t.id);
        return { ...t, pos_x: pos.x, pos_y: pos.y };
      })
    );

    setSaving(false);
  }, [supabase, tables, relationships]);

  return {
    tables,
    relationships,
    saving,
    addTable,
    renameTable,
    setTableColor,
    updateTableMeta,
    moveTable,
    deleteTable,
    addColumn,
    updateColumn,
    deleteColumn,
    addRelationship,
    deleteRelationship,
    applySuggestions,
    relayoutAllTables,
    generateJsonShape,
    DEFAULT_TYPES,
  };
}
