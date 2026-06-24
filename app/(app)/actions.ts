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
