import { NextResponse } from "next/server";
import { fetchTableRows, runReadQuery } from "@/lib/customerDb";
import { AccessError, requireDiagramAccess } from "@/lib/diagramAccess";

export const runtime = "nodejs";

/** Read rows from a table or run a SELECT on the customer's database. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      diagramId?: string;
      table?: string;
      sql?: string;
    };
    const diagramId = body.diagramId?.trim();
    if (!diagramId) {
      return NextResponse.json({ error: "diagramId required" }, { status: 400 });
    }

    const access = await requireDiagramAccess(diagramId);
    if (!access.dbConnected || !access.cipher) {
      return NextResponse.json(
        { error: "Database not connected for this project" },
        { status: 400 }
      );
    }

    if (body.sql?.trim()) {
      const result = await runReadQuery(access.cipher, body.sql);
      return NextResponse.json(result);
    }

    const table = body.table?.trim();
    if (!table) {
      return NextResponse.json(
        { error: "table or sql is required" },
        { status: 400 }
      );
    }

    const result = await fetchTableRows(access.cipher, table);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Query failed" },
      { status: 400 }
    );
  }
}
