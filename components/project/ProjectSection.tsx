"use client";

import Link from "next/link";
import { useProjectStore } from "@/lib/projectStore";
import { updateDiagramConnections } from "@/lib/plans";
import { usePendingChanges } from "@/lib/pendingChanges";
import type { Diagram, ProjectEnv } from "@/lib/types";
import { Inspector } from "./Inspector";

export function ProjectSection({
  diagram,
  siblingDiagrams,
}: {
  diagram: Diagram;
  siblingDiagrams: { id: string; name: string }[];
}) {
  const {
    env,
    setEnv,
    repoUrl,
    dbHost,
    dbName,
    repoConnected,
    dbConnected,
    setModal,
  } = useProjectStore();
  const { pushToast } = usePendingChanges();

  async function changeEnv(next: ProjectEnv) {
    setEnv(next);
    try {
      await updateDiagramConnections(diagram.id, { active_env: next });
      pushToast("Environment", `Switched to ${next}`);
    } catch (e) {
      pushToast(
        "Env save failed",
        e instanceof Error ? e.message : "Run migration 0012?"
      );
    }
  }

  return (
    <div className="flex h-full min-w-0 flex-1">
      <aside className="flex w-[248px] flex-none flex-col border-r border-[#2E333D] bg-[#15181E]">
        <div className="border-b border-[#2E333D] px-3 py-2.5 text-[10px] uppercase text-[#646D7E]">
          Projects
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {siblingDiagrams.map((d) => (
            <Link
              key={d.id}
              href={`/diagram/${d.id}`}
              className={`block truncate px-3 py-2 text-xs ${
                d.id === diagram.id
                  ? "bg-[#1A1D23] text-[#6E9BF5]"
                  : "text-[#9AA3B2] hover:bg-[#1A1D23]/50"
              }`}
            >
              {d.name}
            </Link>
          ))}
        </div>
        <div className="border-t border-[#2E333D] p-3">
          <Link
            href="/dashboard"
            className="block cursor-pointer rounded border border-[#2E333D] py-1.5 text-center text-xs text-[#9AA3B2] hover:text-[#E7EAF0]"
          >
            ＋ New / manage on dashboard
          </Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto bg-[#111318] p-6">
        <h2 className="text-lg font-semibold text-[#E7EAF0]">{diagram.name}</h2>
        <p className="mt-1 text-xs text-[#9AA3B2]">
          Connections and environment for this project.
        </p>

        <section className="mt-6 max-w-lg space-y-4">
          <div className="rounded-md border border-[#2E333D] bg-[#15181E] p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#E7EAF0]">Repository</h3>
              <span
                className={`text-[10px] ${repoConnected ? "text-[#3FB27F]" : "text-[#646D7E]"}`}
              >
                {repoConnected ? "connected" : "not connected"}
              </span>
            </div>
            <p className="mt-2 break-all font-mono text-xs text-[#9AA3B2]">
              {repoUrl || "—"}
            </p>
          </div>

          <div className="rounded-md border border-[#2E333D] bg-[#15181E] p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#E7EAF0]">Database</h3>
              <span
                className={`text-[10px] ${dbConnected ? "text-[#3FB27F]" : "text-[#646D7E]"}`}
              >
                {dbConnected ? "connected" : "not connected"}
              </span>
            </div>
            <p className="mt-2 font-mono text-xs text-[#9AA3B2]">
              {dbHost || "—"} / {dbName || "—"}
            </p>
          <button
            type="button"
            onClick={() => setModal(dbConnected ? "editDb" : "connect")}
            className="mt-3 cursor-pointer text-xs text-[#6E9BF5]"
          >
            {dbConnected ? "Update database connection" : "Connect database"}
          </button>
          </div>

          <div className="rounded-md border border-[#2E333D] bg-[#15181E] p-4">
            <h3 className="text-sm font-semibold text-[#E7EAF0]">Environment</h3>
            <div className="mt-3 flex gap-2">
              {(["dev", "staging", "prod"] as ProjectEnv[]).map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => void changeEnv(e)}
                  className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold ${
                    env === e
                      ? e === "prod"
                        ? "bg-[#C25E5E]/25 text-[#C25E5E]"
                        : "bg-[#6E9BF5]/25 text-[#6E9BF5]"
                      : "border border-[#2E333D] text-[#9AA3B2]"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-[#646D7E]">
              Prod mutations require typing PRODUCTION and are enforced on the
              server.
            </p>
          </div>
        </section>
      </div>

      <Inspector title="Project" breadcrumb={diagram.name}>
        <p className="text-xs text-[#9AA3B2]">
          Set <code className="text-[#D9A03F]">APP_ENCRYPTION_KEY</code> in
          server env before connecting a database. Run migrations through{" "}
          <code className="text-[#D9A03F]">0015_db_credentials.sql</code>.
        </p>
      </Inspector>
    </div>
  );
}
