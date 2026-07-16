"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  DiagramPlan,
  DiagramPlanItem,
  PendingChange,
  PlanStatus,
} from "@/lib/types";

function normalizeItem(row: Record<string, unknown>): DiagramPlanItem {
  return {
    id: row.id as string,
    plan_id: row.plan_id as string,
    kind: row.kind as DiagramPlanItem["kind"],
    summary: row.summary as string,
    payload: (row.payload as Record<string, unknown>) ?? {},
    diff_hint: (row.diff_hint as string | null) ?? null,
    sort_order: (row.sort_order as number) ?? 0,
  };
}

function normalizePlan(
  row: Record<string, unknown>,
  items?: DiagramPlanItem[]
): DiagramPlan {
  return {
    id: row.id as string,
    diagram_id: row.diagram_id as string,
    title: row.title as string,
    status: row.status as PlanStatus,
    created_by: (row.created_by as string | null) ?? null,
    created_at: row.created_at as string,
    items,
  };
}

export async function listPlans(diagramId: string): Promise<DiagramPlan[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("diagram_plans")
    .select("*")
    .eq("diagram_id", diagramId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => normalizePlan(r));
}

export async function getPlan(planId: string): Promise<DiagramPlan | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("diagram_plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: items, error: itemsErr } = await supabase
    .from("diagram_plan_items")
    .select("*")
    .eq("plan_id", planId)
    .order("sort_order", { ascending: true });
  if (itemsErr) throw new Error(itemsErr.message);

  return normalizePlan(data, (items ?? []).map(normalizeItem));
}

export async function createPlanFromChanges(input: {
  diagramId: string;
  title: string;
  changes: PendingChange[];
}): Promise<DiagramPlan> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("diagram_plans")
    .insert({
      diagram_id: input.diagramId,
      title: input.title,
      status: "draft",
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (input.changes.length > 0) {
    const { error: itemsErr } = await supabase.from("diagram_plan_items").insert(
      input.changes.map((c, i) => ({
        plan_id: data.id,
        kind: c.kind,
        summary: c.summary,
        payload: c.payload,
        diff_hint: c.diffHint ?? null,
        sort_order: i,
      }))
    );
    if (itemsErr) throw new Error(itemsErr.message);
  }

  return (await getPlan(data.id))!;
}

export async function updatePlanStatus(
  planId: string,
  status: PlanStatus
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("diagram_plans")
    .update({ status })
    .eq("id", planId);
  if (error) throw new Error(error.message);
}

export async function listPlanComments(
  planId: string
): Promise<{ id: string; body: string; author_id: string | null; created_at: string }[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("diagram_plan_comments")
    .select("*")
    .eq("plan_id", planId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    body: r.body as string,
    author_id: (r.author_id as string | null) ?? null,
    created_at: r.created_at as string,
  }));
}

export async function addPlanComment(
  planId: string,
  body: string
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("diagram_plan_comments").insert({
    plan_id: planId,
    body,
    author_id: user?.id ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function updateDiagramConnections(
  diagramId: string,
  patch: {
    repo_url?: string | null;
    db_host?: string | null;
    db_name?: string | null;
    db_connection_hint?: string | null;
    repo_connected?: boolean;
    db_connected?: boolean;
    active_env?: string;
  }
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("diagrams")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", diagramId);
  if (error) throw new Error(error.message);
}
