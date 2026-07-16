"use client";

import { useEffect, useState } from "react";
import { useProjectStore } from "@/lib/projectStore";
import { updateDiagramConnections } from "@/lib/plans";
import { usePendingChanges } from "@/lib/pendingChanges";

export function ProjectModals({ diagramId }: { diagramId: string }) {
  const {
    modal,
    setModal,
    setConnections,
    repoUrl,
    confirmProdGate,
    clearProdGate,
  } = useProjectStore();
  const { clearChanges, pushToast } = usePendingChanges();

  const [repo, setRepo] = useState(repoUrl ?? "");
  const [connectionString, setConnectionString] = useState("");
  const [testing, setTesting] = useState(false);
  const [prodConfirm, setProdConfirm] = useState("");

  useEffect(() => {
    if (modal === "connect" || modal === "editDb") {
      setRepo(repoUrl ?? "");
      setConnectionString("");
      setTesting(false);
    }
    if (modal === "prodGate") setProdConfirm("");
  }, [modal, repoUrl]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && modal) {
        if (modal === "prodGate") clearProdGate();
        else setModal(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, setModal, clearProdGate]);

  if (!modal) return null;

  async function realConnect() {
    if (!connectionString.trim()) {
      pushToast("Connection string required", "Use a postgres:// URL");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/db/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagramId,
          connectionString: connectionString.trim(),
          repoUrl: repo.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connection failed");

      setConnections({
        repoUrl: repo.trim() || null,
        dbHost: data.meta?.host ?? null,
        dbName: data.meta?.database ?? null,
        dbHint: data.meta
          ? `${data.meta.user}@${data.meta.host}/${data.meta.database}`
          : null,
        repoConnected: !!repo.trim(),
        dbConnected: true,
      });
      pushToast("Connected", "Database verified and credentials encrypted.");
      setModal(null);
      setConnectionString("");
    } catch (e) {
      pushToast(
        "Connection failed",
        e instanceof Error ? e.message : "Unknown error"
      );
    } finally {
      setTesting(false);
    }
  }

  async function saveRepoOnly() {
    try {
      await updateDiagramConnections(diagramId, {
        repo_url: repo.trim() || null,
        repo_connected: !!repo.trim(),
      });
      setConnections({
        repoUrl: repo.trim() || null,
        repoConnected: !!repo.trim(),
      });
      pushToast("Repo saved", repo.trim() || "Cleared");
      setModal(null);
    } catch (e) {
      pushToast(
        "Could not save",
        e instanceof Error ? e.message : "Unknown error"
      );
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-[#2E333D] bg-[#1A1D23] p-5 shadow-2xl">
        {(modal === "connect" || modal === "editDb") && (
          <>
            <h2 className="text-base font-semibold text-[#E7EAF0]">
              {modal === "editDb" ? "Update database connection" : "Connect database"}
            </h2>
            <p className="mt-1 text-xs text-[#9AA3B2]">
              Connection string is tested live, then stored encrypted on the
              server. It is never sent back to the browser.
            </p>
            {modal === "connect" && (
              <label className="mt-4 block text-[11px] text-[#646D7E]">
                Repo URL (optional)
                <input
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="https://github.com/org/app"
                  className="mt-1 w-full rounded-md border border-[#2E333D] bg-[#111318] px-2.5 py-2 text-sm text-[#E7EAF0]"
                />
              </label>
            )}
            <label className="mt-3 block text-[11px] text-[#646D7E]">
              Postgres connection string
              <input
                type="password"
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
                placeholder="postgresql://user:pass@host:5432/dbname?sslmode=require"
                className="mt-1 w-full rounded-md border border-[#2E333D] bg-[#111318] px-2.5 py-2 font-mono text-sm text-[#E7EAF0]"
                autoComplete="off"
              />
            </label>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="cursor-pointer rounded-md border border-[#2E333D] px-3 py-1.5 text-sm text-[#9AA3B2]"
              >
                Cancel
              </button>
              {modal === "connect" && (
                <button
                  type="button"
                  onClick={() => void saveRepoOnly()}
                  className="cursor-pointer rounded-md border border-[#2E333D] px-3 py-1.5 text-sm text-[#9AA3B2]"
                >
                  Save repo only
                </button>
              )}
              <button
                type="button"
                disabled={testing || !connectionString.trim()}
                onClick={() => void realConnect()}
                className="cursor-pointer rounded-md bg-[#4EB3A5] px-3 py-1.5 text-sm font-semibold text-[#111318] disabled:opacity-50"
              >
                {testing ? "Testing…" : "Test & save"}
              </button>
            </div>
          </>
        )}

        {modal === "discard" && (
          <>
            <h2 className="text-base font-semibold text-[#E7EAF0]">
              Discard unsaved changes?
            </h2>
            <p className="mt-2 text-sm text-[#9AA3B2]">
              This clears the local change queue. Plans already saved are not
              affected.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="cursor-pointer rounded-md border border-[#2E333D] px-3 py-1.5 text-sm text-[#9AA3B2]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  clearChanges();
                  setModal(null);
                  pushToast("Discarded", "Unsaved changes cleared.");
                }}
                className="cursor-pointer rounded-md bg-[#C25E5E]/20 px-3 py-1.5 text-sm font-semibold text-[#C25E5E]"
              >
                Discard
              </button>
            </div>
          </>
        )}

        {modal === "prodGate" && (
          <>
            <h2 className="text-base font-semibold text-[#E7EAF0]">
              Production gate
            </h2>
            <p className="mt-2 text-sm text-[#9AA3B2]">
              You are in <span className="text-[#C25E5E]">prod</span>. Type{" "}
              <code className="text-[#D9A03F]">PRODUCTION</code> to confirm this
              mutating action.
            </p>
            <input
              value={prodConfirm}
              onChange={(e) => setProdConfirm(e.target.value)}
              className="mt-4 w-full rounded-md border border-[#2E333D] bg-[#111318] px-2.5 py-2 font-mono text-sm text-[#E7EAF0]"
              placeholder="PRODUCTION"
              autoFocus
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={clearProdGate}
                className="cursor-pointer rounded-md border border-[#2E333D] px-3 py-1.5 text-sm text-[#9AA3B2]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={prodConfirm !== "PRODUCTION"}
                onClick={confirmProdGate}
                className="cursor-pointer rounded-md bg-[#C25E5E] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                Confirm
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
