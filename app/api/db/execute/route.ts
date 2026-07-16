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

export const runtime = "nodejs";

/** Execute mutating SQL against the customer's database (prod-gated). */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      diagramId?: string;
      sql?: string;
      statements?: string[];
      confirmProduction?: string;
    };
    const diagramId = body.diagramId?.trim();
    if (!diagramId) {
      return NextResponse.json({ error: "diagramId required" }, { status: 400 });
    }

    const access = await requireDiagramAccess(diagramId);
    assertProdConfirm(access.activeEnv, body.confirmProduction);

    if (!access.dbConnected || !access.cipher) {
      return NextResponse.json(
        { error: "Database not connected for this project" },
        { status: 400 }
      );
    }

    const statements =
      body.statements?.filter(Boolean) ??
      (body.sql ? splitSqlStatements(body.sql) : []);

    if (statements.length === 0) {
      return NextResponse.json({ error: "No SQL to execute" }, { status: 400 });
    }

    const result = await executeStatements(access.cipher, statements);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Execute failed" },
      { status: 400 }
    );
  }
}
