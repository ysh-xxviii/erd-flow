import type {
  ErdRelationship,
  ErdTable,
  SchemaSnapshot,
  SchemaSnapshotRelationship,
} from "@/lib/types";

/** Build a rich schema snapshot for AI routes (tables, columns, constraints, FKs). */
export function buildSchemaSnapshot(
  tables: ErdTable[],
  relationships: ErdRelationship[] = []
): SchemaSnapshot {
  const tableById = new Map(tables.map((t) => [t.id, t]));

  const rels: SchemaSnapshotRelationship[] = [];
  for (const r of relationships) {
    const src = tableById.get(r.source_table_id);
    const tgt = tableById.get(r.target_table_id);
    if (!src || !tgt) continue;
    const srcCol =
      src.columns.find((c) => c.id === r.source_col_id) ??
      src.columns.find((c) => c.is_fk);
    const tgtCol =
      tgt.columns.find((c) => c.id === r.target_col_id) ??
      tgt.columns.find((c) => c.is_pk) ??
      tgt.columns[0];
    rels.push({
      from_table: src.name,
      from_column: srcCol?.name ?? "id",
      to_table: tgt.name,
      to_column: tgtCol?.name,
      cardinality: r.cardinality,
    });
  }

  return {
    tables: tables.map((t) => ({
      name: t.name,
      category: t.category,
      description: t.description.trim() || undefined,
      constraints: t.constraints.length > 0 ? t.constraints : undefined,
      columns: t.columns.map((c) => {
        const col = {
          name: c.name,
          data_type: c.data_type,
          is_pk: c.is_pk,
          is_fk: c.is_fk,
          is_nullable: c.is_nullable,
          default_value: c.default_value,
          label: c.label,
        };
        if (c.json_description?.trim()) {
          Object.assign(col, { json_description: c.json_description.trim() });
        }
        if (c.json_schema?.trim()) {
          Object.assign(col, { json_schema: c.json_schema.trim() });
        }
        return col;
      }),
    })),
    relationships: rels.length > 0 ? rels : undefined,
  };
}
