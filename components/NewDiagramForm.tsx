"use client";

import { useRef } from "react";

export function NewDiagramForm({
  workspaceId,
  action,
}: {
  workspaceId: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} className="flex items-center gap-2">
      <input type="hidden" name="workspace_id" value={workspaceId} />
      <input
        name="name"
        placeholder="New schema name"
        aria-label="New schema name"
        className="w-48 rounded-lg border border-border-subtle bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent-blue focus:outline-none"
      />
      <button
        type="submit"
        className="cursor-pointer whitespace-nowrap rounded-lg bg-accent-blue px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-[#79b6ff]"
      >
        + New schema
      </button>
    </form>
  );
}
