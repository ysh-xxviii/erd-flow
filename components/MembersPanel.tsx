"use client";

import { useState, useTransition } from "react";
import {
  changeMemberRole,
  inviteMember,
  removeMember,
  revokeInvite,
} from "@/app/(app)/actions";
import type {
  WorkspaceInvite,
  WorkspaceMemberInfo,
  WorkspaceRole,
} from "@/lib/types";

function displayName(m: WorkspaceMemberInfo): string {
  return (
    m.full_name?.trim() ||
    m.email?.split("@")[0] ||
    m.user_id.slice(0, 8)
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function MembersPanel({
  workspaceId,
  workspaceOwnerId,
  currentUserId,
  isOwner,
  members,
  invites,
}: {
  workspaceId: string;
  workspaceOwnerId: string;
  currentUserId: string;
  isOwner: boolean;
  members: WorkspaceMemberInfo[];
  invites: WorkspaceInvite[];
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function joinLink(token: string): string {
    if (typeof window === "undefined") return `/join/${token}`;
    return `${window.location.origin}/join/${token}`;
  }

  async function copy(text: string, token: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken((c) => (c === token ? null : c)), 1500);
    } catch {
      /* ignore */
    }
  }

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLastLink(null);
    startTransition(async () => {
      const res = await inviteMember(workspaceId, email, role);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const link = joinLink(res.token);
      setLastLink(link);
      setMessage(
        `Invite ready for ${email.trim()}. Share the join link below — they'll be added when they sign in with that email.`
      );
      setEmail("");
      void copy(link, res.token);
    });
  }

  const memberCount = members.length;

  return (
    <section className="mt-8 rounded-xl border border-border-subtle bg-surface/50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-ink">Members</h2>
          <div className="flex -space-x-2">
            {members.slice(0, 5).map((m) => (
              <div
                key={m.user_id}
                title={displayName(m)}
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-accent-blue/30 text-[9px] font-semibold text-ink"
              >
                {initials(displayName(m))}
              </div>
            ))}
          </div>
          <span className="text-xs text-ink-faint">
            {memberCount} member{memberCount === 1 ? "" : "s"}
            {invites.length > 0 ? ` · ${invites.length} pending` : ""}
          </span>
        </div>
        <span className="text-ink-faint">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="border-t border-border-subtle px-5 py-4">
          {isOwner && (
            <form
              onSubmit={handleInvite}
              className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@company.com"
                className="flex-1 rounded-lg border border-border-subtle bg-canvas px-3 py-2 text-sm text-ink focus:border-accent-blue focus:outline-none"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as WorkspaceRole)}
                className="cursor-pointer rounded-lg border border-border-subtle bg-canvas px-3 py-2 text-sm text-ink"
              >
                <option value="member">Member</option>
                <option value="owner">Owner</option>
              </select>
              <button
                type="submit"
                disabled={isPending}
                className="cursor-pointer rounded-lg bg-accent-blue px-4 py-2 text-sm font-semibold text-white hover:bg-accent-blue/85 disabled:opacity-60"
              >
                {isPending ? "Inviting…" : "Invite"}
              </button>
            </form>
          )}

          {error && (
            <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          {message && (
            <div className="mb-3 rounded-lg border border-accent-green/30 bg-accent-green/10 px-3 py-2 text-sm text-accent-green">
              <p>{message}</p>
              {lastLink && (
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-canvas px-2 py-1 text-xs text-ink">
                    {lastLink}
                  </code>
                  <button
                    type="button"
                    onClick={() => copy(lastLink, "__last__")}
                    className="cursor-pointer rounded bg-accent-green/20 px-2 py-1 text-xs font-semibold text-accent-green"
                  >
                    {copiedToken === "__last__" ? "Copied" : "Copy"}
                  </button>
                </div>
              )}
            </div>
          )}

          <ul className="space-y-1.5">
            {members.map((m) => {
              const isWorkspaceCreator = m.user_id === workspaceOwnerId;
              const isSelf = m.user_id === currentUserId;
              return (
                <li
                  key={m.user_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-card px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent-blue/25 text-[11px] font-semibold text-ink">
                      {initials(displayName(m))}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {displayName(m)}
                        {isSelf && (
                          <span className="ml-1.5 text-[10px] text-ink-faint">
                            (you)
                          </span>
                        )}
                      </p>
                      {m.email && (
                        <p className="truncate text-xs text-ink-faint">
                          {m.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    {isOwner && !isWorkspaceCreator ? (
                      <MemberRoleControls
                        workspaceId={workspaceId}
                        member={m}
                      />
                    ) : (
                      <span className="rounded-md bg-canvas px-2 py-1 text-[11px] font-semibold capitalize text-ink-muted">
                        {m.role}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {isOwner && invites.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                Pending invites
              </h3>
              <ul className="space-y-1.5">
                {invites.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border-subtle bg-card/50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">{inv.email}</p>
                      <p className="text-xs capitalize text-ink-faint">
                        {inv.role} · invited
                      </p>
                    </div>
                    <div className="flex flex-none items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copy(joinLink(inv.token), inv.token)}
                        className="cursor-pointer rounded-md bg-accent-blue/15 px-2 py-1 text-[11px] font-semibold text-accent-blue hover:bg-accent-blue/25"
                      >
                        {copiedToken === inv.token ? "Copied" : "Copy link"}
                      </button>
                      <RevokeButton workspaceId={workspaceId} inviteId={inv.id} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function MemberRoleControls({
  workspaceId,
  member,
}: {
  workspaceId: string;
  member: WorkspaceMemberInfo;
}) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {err && <span className="text-[10px] text-red-300">{err}</span>}
      <select
        value={member.role}
        disabled={isPending}
        onChange={(e) => {
          const role = e.target.value as WorkspaceRole;
          setErr(null);
          startTransition(async () => {
            const res = await changeMemberRole(
              workspaceId,
              member.user_id,
              role
            );
            if (!res.ok) setErr(res.error ?? "Failed");
          });
        }}
        className="cursor-pointer rounded-md border border-border-subtle bg-canvas px-2 py-1 text-[11px] text-ink"
      >
        <option value="member">Member</option>
        <option value="owner">Owner</option>
      </select>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setErr(null);
          startTransition(async () => {
            const res = await removeMember(workspaceId, member.user_id);
            if (!res.ok) setErr(res.error ?? "Failed");
          });
        }}
        className="cursor-pointer rounded-md p-1 text-ink-faint hover:text-red-300"
        aria-label="Remove member"
        title="Remove member"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M3 6h18M8 6V4h8v2m-9 0v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6" />
        </svg>
      </button>
    </div>
  );
}

function RevokeButton({
  workspaceId,
  inviteId,
}: {
  workspaceId: string;
  inviteId: string;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await revokeInvite(workspaceId, inviteId);
        })
      }
      className="cursor-pointer rounded-md px-2 py-1 text-[11px] text-ink-faint hover:text-red-300"
    >
      {isPending ? "…" : "Revoke"}
    </button>
  );
}
