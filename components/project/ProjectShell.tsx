"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type {
  Diagram,
  ErdRelationship,
  ErdTable,
  ProjectEnv,
  WorkspaceRole,
} from "@/lib/types";
import {
  PendingChangesProvider,
  usePendingChanges,
} from "@/lib/pendingChanges";
import { ProjectStoreProvider, useProjectStore } from "@/lib/projectStore";
import { createPlanFromChanges, updateDiagramConnections } from "@/lib/plans";
import { ErdBuilder } from "@/components/erd/ErdBuilder";
import { SectionRail } from "./SectionRail";
import { ProjectModals } from "./ProjectModals";
import { ToastHost } from "./ToastHost";
import { EndpointsSection } from "./EndpointsSection";
import { FilesSection } from "./FilesSection";
import { DatabaseSection } from "./DatabaseSection";
import { PlansSection } from "./PlansSection";
import { FrontendSection } from "./FrontendSection";
import { ProjectSection } from "./ProjectSection";

function ProjectShellInner({
  diagram,
  initialTables,
  initialRelationships,
  userRole,
  currentUser,
  siblingDiagrams,
}: {
  diagram: Diagram;
  initialTables: ErdTable[];
  initialRelationships: ErdRelationship[];
  userRole: WorkspaceRole;
  currentUser: { id: string; name: string };
  siblingDiagrams: { id: string; name: string }[];
}) {
  const {
    activeSection,
    backendTab,
    setBackendTab,
    env,
    setEnv,
    setModal,
    requestProdGate,
  } = useProjectStore();
  const { changes, chipLabel, clearChanges, pushToast } = usePendingChanges();
  const [savingPlan, setSavingPlan] = useState(false);

  const switchEnv = useCallback(
    async (next: ProjectEnv) => {
      setEnv(next);
      try {
        await updateDiagramConnections(diagram.id, { active_env: next });
      } catch {
        /* migration may not be applied yet */
      }
    },
    [diagram.id, setEnv]
  );

  async function saveToPlan() {
    if (changes.length === 0) return;
    setSavingPlan(true);
    try {
      const title =
        changes.length === 1
          ? changes[0].summary
          : `Plan · ${changes.length} changes`;
      const plan = await createPlanFromChanges({
        diagramId: diagram.id,
        title,
        changes,
      });
      clearChanges();
      pushToast("Saved to plan", plan.title);
    } catch (e) {
      pushToast(
        "Could not save plan",
        e instanceof Error
          ? e.message
          : "Run supabase migration 0013_diagram_plans.sql"
      );
    } finally {
      setSavingPlan(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-[#111318]">
      {/* Top bar */}
      <header className="flex h-11 flex-none items-center gap-3 border-b border-[#2E333D] bg-[#15181E] px-3">
        <Link
          href="/dashboard"
          className="truncate text-sm font-semibold text-[#E7EAF0] hover:text-[#6E9BF5]"
        >
          {diagram.name}
        </Link>
        <div className="flex items-center rounded-md border border-[#2E333D] p-0.5">
          {(["dev", "staging", "prod"] as ProjectEnv[]).map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => void switchEnv(e)}
              className={`cursor-pointer rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                env === e
                  ? e === "prod"
                    ? "bg-[#C25E5E]/25 text-[#C25E5E]"
                    : "bg-[#6E9BF5]/20 text-[#6E9BF5]"
                  : "text-[#646D7E] hover:text-[#9AA3B2]"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
        {changes.length > 0 && (
          <span className="hidden truncate rounded-md border border-[#D9A03F]/40 bg-[#D9A03F]/10 px-2 py-0.5 text-[11px] text-[#D9A03F] sm:inline">
            {chipLabel}
          </span>
        )}
        <div className="flex-1" />
        <button
          type="button"
          disabled={changes.length === 0 || savingPlan}
          onClick={() => requestProdGate(() => void saveToPlan())}
          className="cursor-pointer rounded-md bg-[#6E9BF5] px-3 py-1 text-xs font-semibold text-[#111318] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {savingPlan ? "Saving…" : "Save to plan"}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <SectionRail />

        <div className="flex min-w-0 flex-1 flex-col">
          {activeSection === "backend" && (
            <div className="flex flex-none gap-1 border-b border-[#2E333D] bg-[#15181E] px-2">
              {(
                [
                  ["schemas", "Schemas"],
                  ["endpoints", "Endpoints"],
                  ["files", "Files"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setBackendTab(id)}
                  className={`cursor-pointer px-3 py-2 text-xs ${
                    backendTab === id
                      ? "border-b-2 border-[#6E9BF5] text-[#E7EAF0]"
                      : "text-[#646D7E] hover:text-[#9AA3B2]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="min-h-0 flex-1">
            {activeSection === "project" && (
              <ProjectSection
                diagram={diagram}
                siblingDiagrams={siblingDiagrams}
              />
            )}
            {activeSection === "backend" && backendTab === "schemas" && (
              <ErdBuilder
                diagram={diagram}
                initialTables={initialTables}
                initialRelationships={initialRelationships}
                userRole={userRole}
                currentUser={currentUser}
                shellMode
              />
            )}
            {activeSection === "backend" && backendTab === "endpoints" && (
              <EndpointsSection
                diagramId={diagram.id}
                tables={initialTables}
              />
            )}
            {activeSection === "backend" && backendTab === "files" && (
              <FilesSection diagramId={diagram.id} tables={initialTables} />
            )}
            {activeSection === "frontend" && (
              <FrontendSection
                diagramId={diagram.id}
                tables={initialTables}
                diagramName={diagram.name}
              />
            )}
            {activeSection === "database" && (
              <DatabaseSection
                tables={initialTables}
                diagramId={diagram.id}
              />
            )}
            {activeSection === "plans" && (
              <PlansSection diagramId={diagram.id} tables={initialTables} />
            )}
          </div>
        </div>
      </div>

      {changes.length > 0 && (
        <div className="flex h-10 flex-none items-center gap-3 border-t border-[#2E333D] bg-[#15181E] px-4">
          <span className="truncate text-xs text-[#D9A03F]">{chipLabel}</span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setModal("discard")}
            className="cursor-pointer text-xs text-[#9AA3B2] hover:text-[#C25E5E]"
          >
            Discard
          </button>
          <button
            type="button"
            disabled={savingPlan}
            onClick={() => requestProdGate(() => void saveToPlan())}
            className="cursor-pointer rounded-md bg-[#6E9BF5] px-3 py-1 text-xs font-semibold text-[#111318]"
          >
            Save to plan
          </button>
        </div>
      )}

      <ProjectModals diagramId={diagram.id} />
      <ToastHost />
    </div>
  );
}

export function ProjectShell(props: {
  diagram: Diagram;
  initialTables: ErdTable[];
  initialRelationships: ErdRelationship[];
  userRole: WorkspaceRole;
  currentUser: { id: string; name: string };
  siblingDiagrams: { id: string; name: string }[];
  forceConnected?: boolean;
}) {
  const d = props.diagram;
  return (
    <ProjectStoreProvider
      initialEnv={(d.active_env as ProjectEnv) ?? "dev"}
      initialRepoConnected={!!d.repo_connected}
      initialDbConnected={!!d.db_connected}
      initialRepoUrl={d.repo_url ?? null}
      initialDbHost={d.db_host ?? null}
      initialDbName={d.db_name ?? null}
      initialDbHint={d.db_connection_hint ?? null}
      forceConnected={props.forceConnected}
    >
      <PendingChangesProvider>
        <ProjectShellInner {...props} />
      </PendingChangesProvider>
    </ProjectStoreProvider>
  );
}
