import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { castConstraints } from "@/lib/erdLayout";
import type {
  AccentColor,
  Diagram,
  ErdColumn,
  ErdRelationship,
  ErdTable,
  ProjectEnv,
  TableCategory,
  WorkspaceRole,
} from "@/lib/types";
import { ProjectShell } from "@/components/project/ProjectShell";

export default async function DiagramPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ connected?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const forceConnected = sp.connected === "1";
  const supabase = await createClient();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { data: diagram } = await supabase
    .from("diagrams")
    .select("*")
    .eq("id", id)
    .single();

  if (!diagram) notFound();

  const [
    { data: membership },
    { data: workspace },
    { data: profile },
    { data: tableRows },
    { data: relRows },
    { data: siblingRows },
  ] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", diagram.workspace_id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("workspaces")
      .select("owner_id")
      .eq("id", diagram.workspace_id)
      .single(),
    supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("erd_tables").select("*").eq("diagram_id", id),
    supabase.from("erd_relationships").select("*").eq("diagram_id", id),
    supabase
      .from("diagrams")
      .select("id, name")
      .eq("workspace_id", diagram.workspace_id)
      .order("updated_at", { ascending: false }),
  ]);

  const userRole: WorkspaceRole =
    membership?.role === "owner" || workspace?.owner_id === user.id
      ? "owner"
      : "member";

  const currentUser = {
    id: user.id,
    name:
      profile?.full_name?.trim() ||
      profile?.email?.split("@")[0] ||
      user.email?.split("@")[0] ||
      "Someone",
  };

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

  const diagramModel: Diagram = {
    ...(diagram as Diagram),
    repo_url: diagram.repo_url ?? null,
    db_host: diagram.db_host ?? null,
    db_name: diagram.db_name ?? null,
    db_connection_hint: diagram.db_connection_hint ?? null,
    repo_connected: !!diagram.repo_connected,
    db_connected: !!diagram.db_connected,
    active_env: (diagram.active_env as ProjectEnv) ?? "dev",
  };

  return (
    <ProjectShell
      diagram={diagramModel}
      initialTables={tables}
      initialRelationships={(relRows ?? []) as ErdRelationship[]}
      userRole={userRole}
      currentUser={currentUser}
      siblingDiagrams={(siblingRows ?? []).map((d) => ({
        id: d.id as string,
        name: d.name as string,
      }))}
      forceConnected={forceConnected}
    />
  );
}
