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
    dbHost,
    dbName,
    dbHint,
    confirmProdGate,
    clearProdGate,
  } = useProjectStore();
  const { clearChanges, pushToast } = usePendingChanges();

  const [repo, setRepo] = useState(repoUrl ?? "");
  const [host, setHost] = useState(dbHost ?? "");
  const [name, setName] = useState(dbName ?? "");
  const [hint, setHint] = useState(dbHint ?? "");
  const [testing, setTesting] = useState(false);
  const [prodConfirm, setProdConfirm] = useState("");

  useEffect(() => {
    if (modal === "connect" || modal === "editDb") {
      setRepo(repoUrl ?? "");
      setHost(dbHost ?? "");
      setName(dbName ?? "");
      setHint(dbHint ?? "");
      setTesting(false);
    }
    if (modal === "prodGate") setProdConfirm("");
  }, [modal, repoUrl, dbHost, dbName, dbHint]);

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

  async function fakeTestAndSave(connectBoth: boolean) {
    setTesting(true);
    await new Promise((r) => setTimeout(r, 600));
    setTesting(false);
    const patch = {
      repo_url: repo || null,
      db_host: host || null,
      db_name: name || null,
      db_connection_hint: hint || null,
      repo_connected: connectBoth ? !!repo : !!repo,
      db_connected: connectBoth ? !!(host && name) : !!(host && name),
    };
    try {
      await updateDiagramConnections(diagramId, patch);
      setConnections({
        repoUrl: patch.repo_url,
        dbHost: patch.db_host,
        dbName: patch.db_name,
        dbHint: patch.db_connection_hint,
        repoConnected: patch.repo_connected,
        dbConnected: patch.db_connected,
      });
      pushToast("Connected", "Repo and database connection saved.");
      setModal(null);
    } catch (e) {
      pushToast(
        "Could not save connection",
        e instanceof Error ? e.message : "Unknown error"
      );
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-[#2E333D] bg-[#1A1D23] p-5 shadow-2xl">
        {modal === "connect" && (
          <>
            <h2 className="text-base font-semibold text-[#E7EAF0]">
              Connect repo & database
            </h2>
            <p className="mt-1 text-xs text-[#9AA3B2]">
              MVP uses a fake test-connection. Credentials are not executed.
            </p>
            <label className="mt-4 block text-[11px] text-[#646D7E]">
              Repo URL
              <input
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="https://github.com/org/app"
                className="mt-1 w-full rounded-md border border-[#2E333D] bg-[#111318] px-2.5 py-2 text-sm text-[#E7EAF0]"
              />
            </label>
            <label className="mt-3 block text-[11px] text-[#646D7E]">
              DB host
              <input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="db.example.com"
                className="mt-1 w-full rounded-md border border-[#2E333D] bg-[#111318] px-2.5 py-2 text-sm text-[#E7EAF0]"
              />
            </label>
            <label className="mt-3 block text-[11px] text-[#646D7E]">
              Database name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="app_production"
                className="mt-1 w-full rounded-md border border-[#2E333D] bg-[#111318] px-2.5 py-2 text-sm text-[#E7EAF0]"
              />
            </label>
            <label className="mt-3 block text-[11px] text-[#646D7E]">
              Connection hint (non-secret)
              <input
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder="postgres · ssl · read-write"
                className="mt-1 w-full rounded-md border border-[#2E333D] bg-[#111318] px-2.5 py-2 text-sm text-[#E7EAF0]"
              />
            </label>
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
                disabled={testing || !repo || !host || !name}
                onClick={() => void fakeTestAndSave(true)}
                className="cursor-pointer rounded-md bg-[#6E9BF5] px-3 py-1.5 text-sm font-semibold text-[#111318] disabled:opacity-50"
              >
                {testing ? "Testing…" : "Test & connect"}
              </button>
            </div>
          </>
        )}

        {modal === "editDb" && (
          <>
            <h2 className="text-base font-semibold text-[#E7EAF0]">
              Edit database connection
            </h2>
            <label className="mt-4 block text-[11px] text-[#646D7E]">
              DB host
              <input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="mt-1 w-full rounded-md border border-[#2E333D] bg-[#111318] px-2.5 py-2 text-sm text-[#E7EAF0]"
              />
            </label>
            <label className="mt-3 block text-[11px] text-[#646D7E]">
              Database name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-[#2E333D] bg-[#111318] px-2.5 py-2 text-sm text-[#E7EAF0]"
              />
            </label>
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
                disabled={testing}
                onClick={() => void fakeTestAndSave(false)}
                className="cursor-pointer rounded-md bg-[#4EB3A5] px-3 py-1.5 text-sm font-semibold text-[#111318]"
              >
                {testing ? "Testing…" : "Save"}
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
              This clears the local change queue. Nothing already saved to a plan
              is affected.
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
              <code className="text-[#D9A03F]">PRODUCTION</code> to confirm.
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
