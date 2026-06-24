import type { ErdColumn } from "@/lib/types";
import { isJsonColumn } from "@/lib/jsonShapes";

export interface JsonShapeAiInput {
  tableName: string;
  columnName: string;
  tableDescription?: string;
  siblingColumns?: { name: string; data_type: string }[];
  productContext?: string;
}

export interface JsonShapeAiResult {
  json_description: string;
  json_schema: string;
}

export function needsJsonShapeGeneration(col: ErdColumn): boolean {
  if (!isJsonColumn(col)) return false;
  const hasDesc = !!col.json_description?.trim();
  const schema = col.json_schema?.trim() ?? "";
  const hasSchema = schema.length > 0 && schema !== "{}";
  return !hasDesc || !hasSchema;
}

export async function fetchJsonShapeFromAi(
  input: JsonShapeAiInput
): Promise<JsonShapeAiResult> {
  const res = await fetch("/api/ai/generate-json-shape", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table_name: input.tableName,
      column_name: input.columnName,
      table_description: input.tableDescription ?? "",
      sibling_columns: input.siblingColumns ?? [],
      product_context: input.productContext ?? "",
    }),
  });

  const json = (await res.json()) as JsonShapeAiResult & { error?: string };
  if (!res.ok) {
    throw new Error(json.error || "Failed to generate JSON shape.");
  }

  return {
    json_description: json.json_description,
    json_schema: json.json_schema,
  };
}
