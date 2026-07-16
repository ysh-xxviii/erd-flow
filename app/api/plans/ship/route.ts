import { NextResponse } from "next/server";
import {
  executeStatements,
  splitSqlStatements,
} from "@/lib/customerDb";
import {
  AccessError,
  assertProdConfirm,
  requireDiagramAccess,
} from "@/lib/diagramAccess";
import {
  buildSnapshot,
  generateCreateSql,
  generateDiffSql,
} from "@/lib/sqlGenerator";
import { castConstraints } from "@/lib/erdLayout";
import type {
  AccentColor,
  ErdColumn,
  ErdRelationship,
  ErdTable,
  TableCategory,
} from "@/lib/types";

export const runtime = "nodejs";

/**
 * Approve & ship a plan: run SQL from plan items (and optional schema diff)
 * against the connected customer database, then mark the plan approved.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      planId?: string;
      diagramId?: string;
      confirmProduction?: string;
      includeSchemaSync?: boolean;
    };

    const planId = body.planId?.trim();
    const diagramId = body.diagramId?.trim();
    if (!planId || !diagramId) {
      return NextResponse.json(
        { error: "planId and diagramId are required" },
        { status: 400 }
      );
    }

    const access = await requireDiagramAccess(diagramId);
    assertProdConfirm(access.activeEnv, body.confirmProduction);

    if (access.role !== "owner") {
      return NextResponse.json(
        { error: "Only workspace owners can ship plans" },
        { status: 403 }
      );
    }

    if (!access.dbConnected || !access.cipher) {
      return NextResponse.json(
        {
          error:
            "Connect a customer database before shipping. Open Project → Connect.",
        },
        { status: 400 }
      );
    }

    const { data: plan, error: planErr } = await access.supabase
      .from("diagram_plans")
      .select("*")
      .eq("id", planId)
      .eq("diagram_id", diagramId)
      .maybeSingle();
    if (planErr) throw new Error(planErr.message);
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const { data: items, error: itemsErr } = await access.supabase
      .from("diagram_plan_items")
      .select("*")
      .eq("plan_id", planId)
      .order("sort_order", { ascending: true });
    if (itemsErr) throw new Error(itemsErr.message);

    const statements: string[] = [];
    for (const item of items ?? []) {
      const payload = (item.payload ?? {}) as Record<string, unknown>;
      if (typeof payload.sql === "string" && payload.sql.trim()) {
        statements.push(...splitSqlStatements(payload.sql));
      }
    }

    // Optional: sync full ERD schema DDL when shipping schema-related plans
    const hasSchemaItem = (items ?? []).some(
      (i) => i.kind === "schema" || i.kind === "db_row"
    );
    if (body.includeSchemaSync !== false && hasSchemaItem) {
      const schemaSql = await buildDiagramSql(access.supabase, diagramId);
      if (schemaSql.trim()) {
        statements.push(...splitSqlStatements(schemaSql));
      }
    }

    // Deduplicate while preserving order
    const seen = new Set<string>();
    const unique = statements.filter((s) => {
      const key = s.replace(/\s+/g, " ").toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (unique.length === 0) {
      // Code-only plan (writeup/file): mark approved without DB apply
      const { error: updErr } = await access.supabase
        .from("diagram_plans")
        .update({ status: "approved" })
        .eq("id", planId);
      if (updErr) throw new Error(updErr.message);
      return NextResponse.json({
        ok: true,
        applied: 0,
        mode: "code_only",
        message:
          "Plan approved. No SQL statements were present — nothing applied to the database.",
      });
    }

    const result = await executeStatements(access.cipher, unique);

    const { error: updErr } = await access.supabase
      .from("diagram_plans")
      .update({ status: "approved" })
      .eq("id", planId);
    if (updErr) throw new Error(updErr.message);

    return NextResponse.json({
      ok: true,
      applied: result.applied,
      results: result.results,
      mode: "database",
      message: `Applied ${result.applied} statement(s) to the customer database.`,
    });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ship failed" },
      { status: 400 }
    );
  }
}

async function buildDiagramSql(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  diagramId: string
): Promise<string> {
  const [{ data: tableRows }, { data: relRows }, { data: migrations }] =
    await Promise.all([
      supabase.from("erd_tables").select("*").eq("diagram_id", diagramId),
      supabase.from("erd_relationships").select("*").eq("diagram_id", diagramId),
      supabase
        .from("diagram_migrations")
        .select("snapshot")
        .eq("diagram_id", diagramId)
        .order("version", { ascending: false })
        .limit(1),
    ]);

  const tableIds = (tableRows ?? []).map((t) => t.id as string);
  let columnRows: ErdColumn[] = [];
  if (tableIds.length > 0) {
    const { data } = await supabase
      .from("erd_columns")
      .select("*")
      .in("table_id", tableIds)
      .order("ordinal", { ascending: true });
    columnRows = (data ?? []) as ErdColumn[];
  }

  const tables: ErdTable[] = (tableRows ?? []).map((t) => ({
    id: t.id as string,
    diagram_id: t.diagram_id as string,
    name: t.name as string,
    color: t.color as AccentColor,
    category: ((t.category as TableCategory) ?? "core") as TableCategory,
    description: (t.description as string) ?? "",
    constraints: castConstraints(t.constraints),
    pos_x: t.pos_x as number,
    pos_y: t.pos_y as number,
    columns: columnRows.filter((c) => c.table_id === t.id),
  }));

  const relationships = (relRows ?? []) as ErdRelationship[];
  const live = buildSnapshot(tables, relationships);
  const prev = migrations?.[0]?.snapshot as
    | ReturnType<typeof buildSnapshot>
    | undefined;

  if (prev) {
    return generateDiffSql(prev, live);
  }
  return generateCreateSql(live);
}
