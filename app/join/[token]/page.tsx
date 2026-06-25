import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not signed in: send them to sign up with the invited email, returning here.
  if (!user) {
    redirect(`/signup?redirect=/join/${token}`);
  }

  // Accept any invites addressed to this user's email (email-matched, secure).
  await supabase.rpc("accept_pending_invites");

  // Try to resolve the workspace for this token to land on the right page.
  const { data: invite } = await supabase
    .from("workspace_invites")
    .select("workspace_id")
    .eq("token", token)
    .maybeSingle();

  if (invite?.workspace_id) {
    redirect(`/dashboard?ws=${invite.workspace_id}`);
  }
  redirect("/dashboard");
}
