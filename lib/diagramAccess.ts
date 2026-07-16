import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { ProjectEnv } from "@/lib/types";

export type DiagramAccess = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  diagramId: string;
  workspaceId: string;
  activeEnv: ProjectEnv;
  dbConnected: boolean;
  hasCipher: boolean;
  cipher: string | null;
  role: "owner" | "member";
};

export async function requireDiagramAccess(
  diagramId: string
): Promise<DiagramAccess> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AccessError("Unauthorized", 401);

  const { data: diagram, error } = await supabase
    .from("diagrams")
    .select("id, workspace_id, active_env, db_connected, repo_connected")
    .eq("id", diagramId)
    .maybeSingle();

  if (error) throw new AccessError(error.message, 400);
  if (!diagram) throw new AccessError("Diagram not found", 404);

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", diagram.workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("owner_id")
    .eq("id", diagram.workspace_id)
    .maybeSingle();

  const isOwner =
    membership?.role === "owner" || workspace?.owner_id === user.id;
  if (!membership && !isOwner) {
    throw new AccessError("Forbidden", 403);
  }

  // Cipher is service-role only — never selected via the user client.
  let cipher: string | null = null;
  try {
    const admin = createServiceRoleClient();
    const { data: secret } = await admin
      .from("diagram_db_secrets")
      .select("cipher")
      .eq("diagram_id", diagramId)
      .maybeSingle();
    cipher = (secret?.cipher as string | null) ?? null;

    // Fallback: legacy column on diagrams (pre-secrets-table).
    if (!cipher) {
      const { data: legacy } = await admin
        .from("diagrams")
        .select("db_connection_cipher")
        .eq("id", diagramId)
        .maybeSingle();
      cipher = (legacy?.db_connection_cipher as string | null) ?? null;
    }
  } catch {
    cipher = null;
  }

  return {
    supabase,
    userId: user.id,
    diagramId,
    workspaceId: diagram.workspace_id as string,
    activeEnv: ((diagram.active_env as ProjectEnv) || "dev") as ProjectEnv,
    dbConnected: !!diagram.db_connected,
    hasCipher: !!cipher,
    cipher,
    role: isOwner ? "owner" : "member",
  };
}

export async function saveDiagramCipher(
  diagramId: string,
  cipher: string
): Promise<void> {
  const admin = createServiceRoleClient();
  const { error } = await admin.from("diagram_db_secrets").upsert({
    diagram_id: diagramId,
    cipher,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export function assertProdConfirm(
  env: ProjectEnv,
  confirmProduction?: string | null
) {
  if (env !== "prod") return;
  if (confirmProduction !== "PRODUCTION") {
    throw new AccessError(
      "Production confirmation required. Send confirmProduction: \"PRODUCTION\".",
      403
    );
  }
}

export class AccessError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
