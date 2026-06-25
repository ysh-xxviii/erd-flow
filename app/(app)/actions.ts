"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createDiagram(formData: FormData) {
  const workspaceId = String(formData.get("workspace_id") || "");
  const name = String(formData.get("name") || "").trim() || "Untitled Schema";

  if (!workspaceId) return;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("diagrams")
    .insert({ workspace_id: workspaceId, name })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Could not create diagram");
  }

  redirect(`/diagram/${data.id}`);
}

export async function createWorkspace(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("workspaces")
    .insert({ name, owner_id: user.id })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Could not create workspace");
  }

  // Add the creator as an owner member so RLS lets them see it.
  await supabase
    .from("workspace_members")
    .insert({ workspace_id: data.id, user_id: user.id, role: "owner" });

  revalidatePath("/dashboard");
  redirect(`/dashboard?ws=${data.id}`);
}

export async function deleteDiagram(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("diagrams").delete().eq("id", id);
  revalidatePath("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Resolve or reopen a diagram comment (any member with diagram access). */
export async function resolveDiagramComment(
  commentId: string,
  resolved: boolean
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  // RLS ensures only accessible comments are returned.
  const { data: comment, error: readError } = await supabase
    .from("diagram_comments")
    .select("id")
    .eq("id", commentId)
    .maybeSingle();
  if (readError || !comment) {
    return { ok: false, error: "Comment not found or not accessible" };
  }

  try {
    const { createServiceRoleClient } = await import("@/lib/supabase/admin");
    const admin = createServiceRoleClient();
    const { error: updateError } = await admin
      .from("diagram_comments")
      .update({ resolved })
      .eq("id", commentId);
    if (updateError) return { ok: false, error: updateError.message };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not resolve comment",
    };
  }
}

// =====================================================================
// Member + invite management (owner-guarded)
// =====================================================================

export type InviteResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

async function requireOwner(workspaceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isOwner: false };

  const { data } = await supabase.rpc("is_workspace_owner", {
    ws: workspaceId,
  });
  return { supabase, user, isOwner: data === true };
}

export async function inviteMember(
  workspaceId: string,
  email: string,
  role: "owner" | "member"
): Promise<InviteResult> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (role !== "owner" && role !== "member") {
    return { ok: false, error: "Invalid role." };
  }

  const { supabase, isOwner } = await requireOwner(workspaceId);
  if (!isOwner) {
    return { ok: false, error: "Only workspace owners can invite members." };
  }

  // Reuse an existing pending invite if one exists (keeps the token stable).
  const { data: existing } = await supabase
    .from("workspace_invites")
    .select("token, accepted_at")
    .eq("workspace_id", workspaceId)
    .ilike("email", cleanEmail)
    .is("accepted_at", null)
    .maybeSingle();

  if (existing?.token) {
    if (role) {
      await supabase
        .from("workspace_invites")
        .update({ role })
        .eq("workspace_id", workspaceId)
        .ilike("email", cleanEmail)
        .is("accepted_at", null);
    }
    revalidatePath("/dashboard");
    return { ok: true, token: existing.token as string };
  }

  const { data, error } = await supabase
    .from("workspace_invites")
    .insert({ workspace_id: workspaceId, email: cleanEmail, role })
    .select("token")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message || "Could not create invite." };
  }

  revalidatePath("/dashboard");
  return { ok: true, token: data.token as string };
}

export async function revokeInvite(
  workspaceId: string,
  inviteId: string
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, isOwner } = await requireOwner(workspaceId);
  if (!isOwner) return { ok: false, error: "Not authorized." };

  const { error } = await supabase
    .from("workspace_invites")
    .delete()
    .eq("id", inviteId)
    .eq("workspace_id", workspaceId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function changeMemberRole(
  workspaceId: string,
  userId: string,
  role: "owner" | "member"
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user, isOwner } = await requireOwner(workspaceId);
  if (!isOwner) return { ok: false, error: "Not authorized." };

  // Prevent the workspace owner from demoting themselves and orphaning it.
  const { data: ws } = await supabase
    .from("workspaces")
    .select("owner_id")
    .eq("id", workspaceId)
    .single();
  if (ws?.owner_id === userId && role !== "owner") {
    return { ok: false, error: "The workspace creator must remain an owner." };
  }
  void user;

  const { error } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function removeMember(
  workspaceId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, isOwner } = await requireOwner(workspaceId);
  if (!isOwner) return { ok: false, error: "Not authorized." };

  const { data: ws } = await supabase
    .from("workspaces")
    .select("owner_id")
    .eq("id", workspaceId)
    .single();
  if (ws?.owner_id === userId) {
    return { ok: false, error: "Cannot remove the workspace creator." };
  }

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function acceptPendingInvites(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.rpc("accept_pending_invites");
  revalidatePath("/dashboard");
}
