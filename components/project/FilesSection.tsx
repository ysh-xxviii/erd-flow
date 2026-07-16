"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApiRequest, ErdTable } from "@/lib/types";
import { listRequests } from "@/lib/apiTesting";
import { mockBackendFiles } from "@/lib/mockData";
import { useProjectStore } from "@/lib/projectStore";
import { usePendingChanges } from "@/lib/pendingChanges";
import { NotConnectedState } from "./NotConnectedState";
import { Inspector } from "./Inspector";

export function FilesSection({
  diagramId,
  tables,
}: {
  diagramId: string;
  tables: ErdTable[];
}) {
  const { isFullyConnected, selectedFilePath, setSelectedFilePath } =
    useProjectStore();
  const { addChange, pushToast } = usePendingChanges();
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [content, setContent] = useState("");

  useEffect(() => {
    void listRequests(diagramId).then(setRequests).catch(() => setRequests([]));
  }, [diagramId]);

  const files = useMemo(
    () => mockBackendFiles(tables, requests),
    [tables, requests]
  );

  useEffect(() => {
    if (!selectedFilePath && files[0]) setSelectedFilePath(files[0].path);
  }, [files, selectedFilePath, setSelectedFilePath]);

  const selected = files.find((f) => f.path === selectedFilePath);

  useEffect(() => {
    if (!selectedFilePath) return;
    const key = `cc-file:${diagramId}:${selectedFilePath}`;
    const stored = localStorage.getItem(key);
    setContent(
      stored ??
        `// ${selectedFilePath}\n// Demo file content for MVP.\nexport {};\n`
    );
  }, [selectedFilePath, diagramId]);

  if (!isFullyConnected) {
    return (
      <div className="flex h-full flex-1">
        <NotConnectedState title="Repo files locked" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-1">
      <aside className="flex w-[248px] flex-none flex-col border-r border-[#2E333D] bg-[#15181E]">
        <div className="border-b border-[#2E333D] px-3 py-2.5 text-[10px] uppercase tracking-wider text-[#646D7E]">
          Files
          <span className="mt-0.5 block normal-case tracking-normal text-[#646D7E]">
            Schema-derived map (git clone not enabled yet)
          </span>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {files.map((f) => (
            <button
              key={f.path}
              type="button"
              onClick={() => setSelectedFilePath(f.path)}
              className={`block w-full truncate px-3 py-1.5 text-left font-mono text-[11px] ${
                f.path === selectedFilePath
                  ? "bg-[#1A1D23] text-[#6E9BF5]"
                  : "text-[#9AA3B2] hover:bg-[#1A1D23]/50"
              }`}
            >
              {f.path}
            </button>
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-[#111318] p-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-0 flex-1 resize-none rounded-md border border-[#2E333D] bg-[#15181E] p-3 font-mono text-xs text-[#E7EAF0]"
        />
        <button
          type="button"
          onClick={() => {
            if (!selectedFilePath) return;
            localStorage.setItem(
              `cc-file:${diagramId}:${selectedFilePath}`,
              content
            );
            addChange({
              kind: "file",
              summary: `Update ${selectedFilePath}`,
              label: selectedFilePath.split("/").pop() ?? "file",
              payload: { path: selectedFilePath },
              diffHint: "modified",
            });
            pushToast("File edit queued", selectedFilePath);
          }}
          className="mt-2 w-fit cursor-pointer rounded-md bg-[#6E9BF5] px-3 py-1.5 text-sm font-semibold text-[#111318]"
        >
          Save (draft plan item)
        </button>
      </div>

      <Inspector title={selected?.path ?? "File"} breadcrumb="Backend / Files">
        {selected ? (
          <div className="space-y-2 text-xs text-[#9AA3B2]">
            <p>
              Kind: <span className="text-[#E7EAF0]">{selected.kind}</span>
            </p>
            <p className="text-[10px] uppercase text-[#646D7E]">Serves</p>
            <ul className="space-y-1">
              {selected.serves.length === 0 && (
                <li className="text-[#646D7E]">—</li>
              )}
              {selected.serves.map((s) => (
                <li key={s} className="font-mono text-[#4EB3A5]">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-[#646D7E]">Select a file</p>
        )}
      </Inspector>
    </div>
  );
}
