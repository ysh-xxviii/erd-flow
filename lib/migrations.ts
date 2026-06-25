"use client";

// Client-side data access for the per-diagram migration history.
// Uses the authenticated Supabase browser client; RLS enforces access.

import { createClient } from "@/lib/supabase/client";
import type { MigrationSnapshot } from "@/lib/sqlGenerator";

export interface DiagramMigration {
  id: string;
  diagram_id: string;
  version: number;
  name: string;
  sql: string;
  snapshot: MigrationSnapshot;
  created_by: string | null;
  created_at: string;
}

export async function listMigrations(
  diagramId: string
): Promise<DiagramMigration[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("diagram_migrations")
    .select("*")
    .eq("diagram_id", diagramId)
    .order("version", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DiagramMigration[];
}

export async function getLatestMigration(
  diagramId: string
): Promise<DiagramMigration | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("diagram_migrations")
    .select("*")
    .eq("diagram_id", diagramId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as DiagramMigration | null) ?? null;
}

export async function createMigration(
  diagramId: string,
  input: { name: string; sql: string; snapshot: MigrationSnapshot; version: number }
): Promise<DiagramMigration> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("diagram_migrations")
    .insert({
      diagram_id: diagramId,
      version: input.version,
      name: input.name,
      sql: input.sql,
      snapshot: input.snapshot,
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as DiagramMigration;
}

export async function deleteMigration(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("diagram_migrations")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export function nextVersion(latest: DiagramMigration | null): number {
  return (latest?.version ?? 0) + 1;
}

/** zero-padded migration filename, e.g. 0003_add_orders.sql */
export function migrationFilename(version: number, name: string): string {
  const slug =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 50) || "migration";
  return `${String(version).padStart(4, "0")}_${slug}.sql`;
}
