"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  PlaybookCheckType,
  PlaybookCriteria,
  PlaybookStep,
} from "@/lib/types";

export async function listSteps(diagramId: string): Promise<PlaybookStep[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("diagram_playbook_steps")
    .select("*")
    .eq("diagram_id", diagramId)
    .order("ordinal", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalizeStep);
}

function normalizeStep(row: Record<string, unknown>): PlaybookStep {
  return {
    id: row.id as string,
    diagram_id: row.diagram_id as string,
    ordinal: row.ordinal as number,
    title: row.title as string,
    instructions: (row.instructions as string) ?? "",
    check_type: row.check_type as PlaybookStep["check_type"],
    criteria: (row.criteria as PlaybookCriteria) ?? {},
    is_done: !!row.is_done,
    done_at: (row.done_at as string | null) ?? null,
    done_by: (row.done_by as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

export async function createStep(
  diagramId: string,
  input: {
    title: string;
    instructions?: string;
    check_type: PlaybookCheckType;
    criteria?: PlaybookCriteria;
    ordinal: number;
  }
): Promise<PlaybookStep> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("diagram_playbook_steps")
    .insert({
      diagram_id: diagramId,
      title: input.title,
      instructions: input.instructions ?? "",
      check_type: input.check_type,
      criteria: input.criteria ?? {},
      ordinal: input.ordinal,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return normalizeStep(data);
}

export async function updateStep(
  id: string,
  patch: Partial<{
    title: string;
    instructions: string;
    check_type: PlaybookCheckType;
    criteria: PlaybookCriteria;
    ordinal: number;
    is_done: boolean;
  }>
): Promise<PlaybookStep> {
  const supabase = createClient();
  const dbPatch: Record<string, unknown> = { ...patch };
  if (patch.is_done !== undefined) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    dbPatch.done_at = patch.is_done ? new Date().toISOString() : null;
    dbPatch.done_by = patch.is_done ? (user?.id ?? null) : null;
  }
  const { data, error } = await supabase
    .from("diagram_playbook_steps")
    .update(dbPatch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return normalizeStep(data);
}

export async function deleteStep(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("diagram_playbook_steps")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function reorderSteps(
  orderedIds: string[]
): Promise<void> {
  const supabase = createClient();
  await Promise.all(
    orderedIds.map((id, ordinal) =>
      supabase
        .from("diagram_playbook_steps")
        .update({ ordinal })
        .eq("id", id)
    )
  );
}

export async function toggleManualDone(
  step: PlaybookStep
): Promise<PlaybookStep> {
  return updateStep(step.id, { is_done: !step.is_done });
}

export async function createStepsBulk(
  diagramId: string,
  steps: {
    title: string;
    instructions?: string;
    check_type: PlaybookCheckType;
    criteria?: PlaybookCriteria;
    ordinal: number;
  }[]
): Promise<PlaybookStep[]> {
  const supabase = createClient();
  const rows = steps.map((s) => ({
    diagram_id: diagramId,
    title: s.title,
    instructions: s.instructions ?? "",
    check_type: s.check_type,
    criteria: s.criteria ?? {},
    ordinal: s.ordinal,
  }));
  const { data, error } = await supabase
    .from("diagram_playbook_steps")
    .insert(rows)
    .select("*");
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalizeStep);
}
