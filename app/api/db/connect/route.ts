import { NextResponse } from "next/server";
import { encryptionConfigured, encryptSecret } from "@/lib/crypto";
import { parseConnectionMeta, testCustomerConnection } from "@/lib/customerDb";
import {
  AccessError,
  requireDiagramAccess,
  saveDiagramCipher,
} from "@/lib/diagramAccess";

export const runtime = "nodejs";

/** Test + persist encrypted postgres connection for a diagram. */
export async function POST(request: Request) {
  try {
    if (!encryptionConfigured()) {
      return NextResponse.json(
        {
          error:
            "Server missing APP_ENCRYPTION_KEY (set a strong secret ≥16 chars in env).",
        },
        { status: 503 }
      );
    }

    const body = (await request.json()) as {
      diagramId?: string;
      connectionString?: string;
      repoUrl?: string | null;
    };

    const diagramId = body.diagramId?.trim();
    const connectionString = body.connectionString?.trim();
    if (!diagramId || !connectionString) {
      return NextResponse.json(
        { error: "diagramId and connectionString are required" },
        { status: 400 }
      );
    }

    const access = await requireDiagramAccess(diagramId);
    const meta = await testCustomerConnection(connectionString);
    const cipher = encryptSecret(connectionString);
    await saveDiagramCipher(diagramId, cipher);

    const patch: Record<string, unknown> = {
      db_host: meta.host,
      db_name: meta.database,
      db_connection_hint: `${meta.user}@${meta.host}/${meta.database}`,
      db_connected: true,
      updated_at: new Date().toISOString(),
    };
    if (body.repoUrl !== undefined) {
      patch.repo_url = body.repoUrl || null;
      patch.repo_connected = !!body.repoUrl;
    }

    const { error } = await access.supabase
      .from("diagrams")
      .update(patch)
      .eq("id", diagramId);
    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      meta: parseConnectionMeta(connectionString),
      repoConnected: !!body.repoUrl,
      dbConnected: true,
    });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Connection failed" },
      { status: 400 }
    );
  }
}
