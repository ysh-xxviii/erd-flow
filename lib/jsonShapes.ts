import type { ErdColumn, ErdTable } from "@/lib/types";
import { formatJsonSchema } from "@/lib/jsonHighlight";

export interface JsonShapeRef {
  columnId: string;
  tableId: string;
  tableName: string;
  columnName: string;
  label: string;
  /** Display index in sidebar (7.1, 7.2, …) */
  index: number;
  description: string;
  jsonSchema: string;
}

export function isJsonColumn(col: ErdColumn): boolean {
  return /json/i.test(col.data_type);
}

export function collectJsonShapes(tables: ErdTable[]): JsonShapeRef[] {
  const shapes: JsonShapeRef[] = [];
  let n = 0;

  for (const table of tables) {
    for (const col of table.columns) {
      if (!isJsonColumn(col)) continue;
      n += 1;
      shapes.push({
        columnId: col.id,
        tableId: table.id,
        tableName: table.name,
        columnName: col.name,
        label: `${table.name}.${col.name}`,
        index: n,
        description:
          col.json_description?.trim() ||
          "Generating description with AI…",
        jsonSchema: formatJsonSchema(col.json_schema),
      });
    }
  }

  return shapes;
}

export function findJsonShape(
  tables: ErdTable[],
  columnId: string
): JsonShapeRef | null {
  return collectJsonShapes(tables).find((s) => s.columnId === columnId) ?? null;
}
