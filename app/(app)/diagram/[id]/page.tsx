import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { castConstraints } from "@/lib/erdLayout";
import type {
  AccentColor,
  Diagram,
  ErdColumn,
  ErdRelationship,
  ErdTable,
  TableCategory,
} from "@/lib/types";
import { ErdBuilder } from "@/components/erd/ErdBuilder";

export default async function DiagramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: diagram } = await supabase
    .from("diagrams")
    .select("*")
    .eq("id", id)
    .single();

  if (!diagram) notFound();

  const { data: tableRows } = await supabase
    .from("erd_tables")
    .select("*")
    .eq("diagram_id", id);

  const tableIds = (tableRows ?? []).map((t) => t.id);

  let columnRows: ErdColumn[] = [];
  if (tableIds.length > 0) {
    const { data } = await supabase
      .from("erd_columns")
      .select("*")
      .in("table_id", tableIds)
      .order("ordinal", { ascending: true });
    columnRows = (data ?? []).map((c) => ({
      ...c,
      default_value: c.default_value ?? null,
      label: c.label ?? null,
      json_description: c.json_description ?? null,
      json_schema: c.json_schema ?? null,
    })) as ErdColumn[];
  }

  const { data: relRows } = await supabase
    .from("erd_relationships")
    .select("*")
    .eq("diagram_id", id);

  const tables: ErdTable[] = (tableRows ?? []).map((t) => ({
    id: t.id,
    diagram_id: t.diagram_id,
    name: t.name,
    color: t.color as AccentColor,
    category: (t.category as TableCategory) ?? "core",
    description: t.description ?? "",
    constraints: castConstraints(t.constraints),
    pos_x: t.pos_x,
    pos_y: t.pos_y,
    columns: columnRows.filter((c) => c.table_id === t.id),
  }));

  return (
    <ErdBuilder
      diagram={diagram as Diagram}
      initialTables={tables}
      initialRelationships={(relRows ?? []) as ErdRelationship[]}
    />
  );
}
