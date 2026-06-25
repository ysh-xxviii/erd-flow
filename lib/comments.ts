"use client";

import { resolveDiagramComment } from "@/app/(app)/actions";
import { createClient } from "@/lib/supabase/client";
import type { DiagramComment } from "@/lib/types";

function normalizeComment(row: Record<string, unknown>): DiagramComment {
  return {
    id: row.id as string,
    diagram_id: row.diagram_id as string,
    table_id: (row.table_id as string | null) ?? null,
    column_id: (row.column_id as string | null) ?? null,
    author_id: (row.author_id as string | null) ?? null,
    body: row.body as string,
    resolved: !!row.resolved,
    created_at: row.created_at as string,
  };
}

/** Fetch all comments for a diagram, enriched with author display names. */
export async function listComments(
  diagramId: string
): Promise<DiagramComment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("diagram_comments")
    .select("*")
    .eq("diagram_id", diagramId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const comments = (data ?? []).map(normalizeComment);
  const authorIds = Array.from(
    new Set(comments.map((c) => c.author_id).filter(Boolean) as string[])
  );

  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", authorIds);
    const names = new Map<string, string>();
    for (const p of profiles ?? []) {
      const name =
        (p.full_name as string | null)?.trim() ||
        (p.email as string | null)?.split("@")[0] ||
        "Someone";
      names.set(p.id as string, name);
    }
    for (const c of comments) {
      c.author_name = c.author_id ? names.get(c.author_id) ?? "Someone" : "Someone";
    }
  }

  return comments;
}

export async function addComment(input: {
  diagramId: string;
  tableId?: string | null;
  columnId?: string | null;
  body: string;
}): Promise<DiagramComment | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("diagram_comments")
    .insert({
      diagram_id: input.diagramId,
      table_id: input.tableId ?? null,
      column_id: input.columnId ?? null,
      author_id: user.id,
      body: input.body,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data ? normalizeComment(data) : null;
}

export async function setCommentResolved(
  id: string,
  resolved: boolean
): Promise<void> {
  const result = await resolveDiagramComment(id, resolved);
  if (!result.ok) {
    throw new Error(result.error ?? "Could not resolve comment");
  }
}

export async function deleteComment(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("diagram_comments")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
