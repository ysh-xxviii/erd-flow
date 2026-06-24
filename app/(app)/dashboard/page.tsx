import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Diagram, Workspace } from "@/lib/types";
import { createDiagram, deleteDiagram } from "../actions";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { NewDiagramForm } from "@/components/NewDiagramForm";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ws?: string }>;
}) {
  const { ws } = await searchParams;
  const supabase = await createClient();

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("*")
    .order("created_at", { ascending: true });

  const list = (workspaces ?? []) as Workspace[];
  const activeWorkspace =
    list.find((w) => w.id === ws) ?? list[0] ?? null;

  let diagrams: Diagram[] = [];
  if (activeWorkspace) {
    const { data } = await supabase
      .from("diagrams")
      .select("*")
      .eq("workspace_id", activeWorkspace.id)
      .order("updated_at", { ascending: false });
    diagrams = (data ?? []) as Diagram[];
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <WorkspaceSwitcher
        workspaces={list}
        activeId={activeWorkspace?.id ?? null}
      />

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Schemas
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {activeWorkspace
              ? `Diagrams in ${activeWorkspace.name}`
              : "Create a workspace to get started"}
          </p>
        </div>
        {activeWorkspace && (
          <NewDiagramForm
            workspaceId={activeWorkspace.id}
            action={createDiagram}
          />
        )}
      </div>

      {diagrams.length === 0 ? (
        <EmptyState hasWorkspace={!!activeWorkspace} />
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {diagrams.map((d) => (
            <li key={d.id}>
              <DiagramCard diagram={d} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function DiagramCard({ diagram }: { diagram: Diagram }) {
  const updated = new Date(diagram.updated_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="group relative rounded-xl border border-border-subtle bg-card p-5 transition-colors hover:border-accent-blue/50">
      <Link href={`/diagram/${diagram.id}`} className="block cursor-pointer">
        <div className="flex h-24 items-center justify-center rounded-lg border border-border-subtle bg-canvas">
          <MiniErd />
        </div>
        <h3 className="mt-4 truncate font-semibold text-ink">
          {diagram.name}
        </h3>
        <p className="mt-1 text-xs text-ink-faint">Updated {updated}</p>
      </Link>
      <form action={deleteDiagram} className="absolute right-3 top-3">
        <input type="hidden" name="id" value={diagram.id} />
        <button
          type="submit"
          aria-label={`Delete ${diagram.name}`}
          className="cursor-pointer rounded-md p-1.5 text-ink-faint opacity-0 transition-all hover:bg-red-500/15 hover:text-red-300 focus-visible:opacity-100 group-hover:opacity-100"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M3 6h18M8 6V4h8v2m-9 0v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6" />
          </svg>
        </button>
      </form>
    </div>
  );
}

function MiniErd() {
  return (
    <svg width="120" height="64" viewBox="0 0 120 64" aria-hidden="true">
      <rect x="8" y="14" width="34" height="26" rx="4" fill="#131a2b" stroke="#5aa6ff" strokeWidth="2" />
      <rect x="8" y="14" width="34" height="6" rx="3" fill="#5aa6ff" />
      <rect x="74" y="22" width="34" height="30" rx="4" fill="#131a2b" stroke="#ef8a52" strokeWidth="2" />
      <rect x="74" y="22" width="34" height="6" rx="3" fill="#ef8a52" />
      <path d="M42 28 Q60 30 74 36" stroke="#8b7bff" strokeWidth="2" fill="none" />
    </svg>
  );
}

function EmptyState({ hasWorkspace }: { hasWorkspace: boolean }) {
  return (
    <div className="mt-10 flex flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle bg-surface/40 px-6 py-16 text-center">
      <div className="mb-4 rounded-xl border border-border-subtle bg-canvas p-4">
        <MiniErd />
      </div>
      <h3 className="text-base font-semibold text-ink">No schemas yet</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">
        {hasWorkspace
          ? "Create your first diagram, define a table, and let AI suggest the rest."
          : "You need a workspace first. Create one from the switcher above."}
      </p>
    </div>
  );
}
