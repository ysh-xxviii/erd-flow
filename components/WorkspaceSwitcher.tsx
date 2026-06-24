"use client";

import { useState } from "react";
import Link from "next/link";
import type { Workspace } from "@/lib/types";
import { createWorkspace } from "@/app/(app)/actions";

export function WorkspaceSwitcher({
  workspaces,
  activeId,
}: {
  workspaces: Workspace[];
  activeId: string | null;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-medium uppercase tracking-wide text-ink-faint">
        Workspace
      </span>
      {workspaces.map((w) => {
        const active = w.id === activeId;
        return (
          <Link
            key={w.id}
            href={`/dashboard?ws=${w.id}`}
            className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "border-accent-blue/60 bg-accent-blue/15 text-ink"
                : "border-border-subtle text-ink-muted hover:bg-card hover:text-ink"
            }`}
          >
            {w.name}
          </Link>
        );
      })}

      {adding ? (
        <form action={createWorkspace} className="flex items-center gap-2">
          <input
            name="name"
            autoFocus
            required
            placeholder="Workspace name"
            aria-label="New workspace name"
            className="w-44 rounded-lg border border-border-subtle bg-canvas px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent-blue focus:outline-none"
          />
          <button
            type="submit"
            className="cursor-pointer rounded-lg bg-accent-blue px-3 py-1.5 text-sm font-semibold text-canvas hover:bg-[#79b6ff]"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="cursor-pointer rounded-lg px-2 py-1.5 text-sm text-ink-muted hover:text-ink"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="cursor-pointer rounded-lg border border-dashed border-border-subtle px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:border-accent-blue/50 hover:text-ink"
        >
          + New workspace
        </button>
      )}
    </div>
  );
}
