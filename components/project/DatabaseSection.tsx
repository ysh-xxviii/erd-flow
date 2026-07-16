"use client";

import { useEffect, useState } from "react";
import type { ErdTable } from "@/lib/types";
import {
  fakeRowCount,
  seedFakeRows,
  stubSqlFromPrompt,
  type FakeRow,
} from "@/lib/mockData";
import { useProjectStore } from "@/lib/projectStore";
import { usePendingChanges } from "@/lib/pendingChanges";
import { NotConnectedState } from "./NotConnectedState";
import { Inspector } from "./Inspector";

export function DatabaseSection({ tables }: { tables: ErdTable[] }) {
  const {
    isFullyConnected,
    dbHost,
    dbName,
    setModal,
    selectedTableId,
    setSelectedTableId,
    requestProdGate,
  } = useProjectStore();
  const { addChange, pushToast } = usePendingChanges();
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [rowsByTable, setRowsByTable] = useState<Record<string, FakeRow[]>>(
    {}
  );
  const [dirty, setDirty] = useState<Record<string, Set<string>>>({});
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiSql, setAiSql] = useState("");
  const [bulkPrompt, setBulkPrompt] = useState("");
  const [bulkPreview, setBulkPreview] = useState<FakeRow[] | null>(null);
  const [editCell, setEditCell] = useState<{
    rowId: string;
    col: string;
  } | null>(null);

  const activeTable =
    tables.find((t) => t.id === (selectedTableId ?? openTabs[0])) ?? null;

  useEffect(() => {
    if (tables[0] && !selectedTableId) setSelectedTableId(tables[0].id);
  }, [tables, selectedTableId, setSelectedTableId]);

  useEffect(() => {
    if (!activeTable) return;
    setRowsByTable((prev) => {
      if (prev[activeTable.id]) return prev;
      return { ...prev, [activeTable.id]: seedFakeRows(activeTable, 8) };
    });
    setOpenTabs((tabs) =>
      tabs.includes(activeTable.id) ? tabs : [...tabs, activeTable.id]
    );
  }, [activeTable]);

  const rows = activeTable ? rowsByTable[activeTable.id] ?? [] : [];

  if (!isFullyConnected) {
    return (
      <div className="flex h-full flex-1">
        <NotConnectedState title="Database locked" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-1">
      <aside className="flex w-[248px] flex-none flex-col border-r border-[#2E333D] bg-[#15181E]">
        <div className="border-b border-[#2E333D] p-3">
          <p className="text-[10px] uppercase text-[#646D7E]">Connection</p>
          <p className="mt-1 truncate font-mono text-xs text-[#E7EAF0]">
            {dbHost ?? "—"}/{dbName ?? "—"}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[#3FB27F]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#3FB27F]" />
            connected
          </div>
          <button
            type="button"
            onClick={() => setModal("editDb")}
            className="mt-2 cursor-pointer text-[11px] text-[#6E9BF5]"
          >
            Edit connection
          </button>
        </div>
        <div className="border-b border-[#2E333D] px-3 py-2 text-[10px] uppercase text-[#646D7E]">
          Tables
        </div>
        <div className="flex-1 overflow-y-auto">
          {tables.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedTableId(t.id)}
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs ${
                t.id === activeTable?.id
                  ? "bg-[#1A1D23] text-[#E7EAF0]"
                  : "text-[#9AA3B2] hover:bg-[#1A1D23]/50"
              }`}
            >
              <span className="truncate font-mono">{t.name}</span>
              <span className="text-[10px] text-[#646D7E]">
                {fakeRowCount(t.name)}
              </span>
            </button>
          ))}
        </div>
        <div className="border-t border-[#2E333D] p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase text-[#B48CF2]">
            ✦ AI
          </p>
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Natural language query…"
            rows={2}
            className="w-full rounded border border-[#2E333D] bg-[#111318] p-2 text-[11px] text-[#E7EAF0]"
          />
          <button
            type="button"
            onClick={() => {
              if (!activeTable) return;
              setAiSql(stubSqlFromPrompt(aiPrompt, activeTable.name));
            }}
            className="mt-2 w-full cursor-pointer rounded bg-[#B48CF2]/20 py-1 text-[11px] font-semibold text-[#B48CF2]"
          >
            Generate SQL
          </button>
          {aiSql && (
            <>
              <pre className="mt-2 max-h-24 overflow-auto rounded border border-[#B48CF2]/30 bg-[#111318] p-2 font-mono text-[10px] text-[#B48CF2]">
                {aiSql}
              </pre>
              <button
                type="button"
                onClick={() =>
                  pushToast("Query ran", "Showing seeded demo rows.")
                }
                className="mt-1 w-full cursor-pointer rounded border border-[#2E333D] py-1 text-[11px] text-[#9AA3B2]"
              >
                Run
              </button>
            </>
          )}
          <textarea
            value={bulkPrompt}
            onChange={(e) => setBulkPrompt(e.target.value)}
            placeholder="Bulk edit with AI…"
            rows={2}
            className="mt-3 w-full rounded border border-[#2E333D] bg-[#111318] p-2 text-[11px] text-[#E7EAF0]"
          />
          <button
            type="button"
            onClick={() => {
              setBulkPreview(rows.slice(0, 3));
            }}
            className="mt-2 w-full cursor-pointer rounded bg-[#D9A03F]/15 py-1 text-[11px] font-semibold text-[#D9A03F]"
          >
            Preview bulk edit
          </button>
          {bulkPreview && (
            <div className="mt-2 space-y-1">
              <p className="text-[10px] text-[#646D7E]">
                {bulkPreview.length} rows affected (demo)
              </p>
              <button
                type="button"
                onClick={() =>
                  requestProdGate(() => {
                    addChange({
                      kind: "db_row",
                      summary: bulkPrompt || "Bulk edit rows",
                      label: activeTable?.name ?? "rows",
                      payload: { tableId: activeTable?.id },
                      diffHint: "modified",
                    });
                    setBulkPreview(null);
                    pushToast("Bulk edit queued", "Added to unsaved changes.");
                  })
                }
                className="w-full cursor-pointer rounded bg-[#D9A03F] py-1 text-[11px] font-semibold text-[#111318]"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-[#111318]">
        <div className="flex gap-0.5 overflow-x-auto border-b border-[#2E333D] bg-[#15181E] px-1">
          {openTabs.map((id) => {
            const t = tables.find((x) => x.id === id);
            if (!t) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedTableId(id)}
                className={`cursor-pointer px-3 py-2 font-mono text-[11px] ${
                  id === activeTable?.id
                    ? "border-b-2 border-[#4EB3A5] text-[#E7EAF0]"
                    : "text-[#646D7E]"
                }`}
              >
                {t.name}
              </button>
            );
          })}
        </div>

        {!activeTable ? (
          <div className="flex flex-1 items-center justify-center text-sm text-[#646D7E]">
            Select a table
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-[#15181E]">
                <tr>
                  {activeTable.columns.map((c) => (
                    <th
                      key={c.id}
                      className="border-b border-[#2E333D] px-2 py-2 font-mono text-[10px] font-normal text-[#646D7E]"
                    >
                      {c.name}
                      <span className="ml-1 text-[#4EB3A5]">{c.data_type}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.__rowId} className="hover:bg-[#1A1D23]/50">
                    {activeTable.columns.map((c) => {
                      const cellKey = `${row.__rowId}:${c.name}`;
                      const isDirty = dirty[activeTable.id]?.has(cellKey);
                      const editing =
                        editCell?.rowId === row.__rowId &&
                        editCell.col === c.name;
                      return (
                        <td
                          key={c.id}
                          onDoubleClick={() => {
                            if (c.is_pk) return;
                            setEditCell({ rowId: row.__rowId, col: c.name });
                          }}
                          className={`border-b border-[#2E333D]/60 px-2 py-1.5 font-mono text-[11px] ${
                            isDirty
                              ? "bg-[#D9A03F]/15 text-[#D9A03F]"
                              : "text-[#E7EAF0]"
                          } ${c.is_pk ? "text-[#646D7E]" : "cursor-text"}`}
                        >
                          {editing ? (
                            <input
                              autoFocus
                              defaultValue={String(row[c.name] ?? "")}
                              className="w-full bg-transparent outline-none"
                              onBlur={(e) => {
                                const val = e.target.value;
                                setRowsByTable((prev) => ({
                                  ...prev,
                                  [activeTable.id]: (
                                    prev[activeTable.id] ?? []
                                  ).map((r) =>
                                    r.__rowId === row.__rowId
                                      ? { ...r, [c.name]: val }
                                      : r
                                  ),
                                }));
                                setDirty((prev) => {
                                  const set = new Set(prev[activeTable.id] ?? []);
                                  set.add(cellKey);
                                  return { ...prev, [activeTable.id]: set };
                                });
                                setEditCell(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  (e.target as HTMLInputElement).blur();
                                if (e.key === "Escape") setEditCell(null);
                              }}
                            />
                          ) : (
                            String(row[c.name] ?? "")
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex gap-2 border-t border-[#2E333D] p-2">
              <button
                type="button"
                onClick={() => {
                  const extra = seedFakeRows(activeTable, 1).map((r) => ({
                    ...r,
                    __rowId: `${activeTable.id}-new-${Date.now()}`,
                  }));
                  setRowsByTable((prev) => ({
                    ...prev,
                    [activeTable.id]: [...(prev[activeTable.id] ?? []), ...extra],
                  }));
                }}
                className="cursor-pointer rounded border border-[#2E333D] px-2 py-1 text-[11px] text-[#9AA3B2]"
              >
                Add row
              </button>
              <button
                type="button"
                onClick={() =>
                  requestProdGate(() => {
                    const n = dirty[activeTable.id]?.size ?? 0;
                    if (n === 0) {
                      pushToast("Nothing dirty", "Edit cells first.");
                      return;
                    }
                    addChange({
                      kind: "db_row",
                      summary: `Commit ${n} cell edit(s) on ${activeTable.name}`,
                      label: activeTable.name,
                      payload: { tableId: activeTable.id },
                      diffHint: "modified",
                    });
                    setDirty((prev) => ({ ...prev, [activeTable.id]: new Set() }));
                    pushToast("Row edits queued", activeTable.name);
                  })
                }
                className="cursor-pointer rounded bg-[#4EB3A5] px-2 py-1 text-[11px] font-semibold text-[#111318]"
              >
                Commit dirty cells
              </button>
            </div>
          </div>
        )}
      </div>

      <Inspector
        title={activeTable?.name ?? "Database"}
        breadcrumb="Database"
      >
        {activeTable ? (
          <div className="space-y-2 text-xs text-[#9AA3B2]">
            <p>
              ~{fakeRowCount(activeTable.name)} rows (demo)
            </p>
            <p>{activeTable.columns.length} columns</p>
            <p className="text-[10px] text-[#646D7E]">
              Double-click cells to edit. PK columns are read-only. Commits go
              to unsaved changes.
            </p>
          </div>
        ) : (
          <p className="text-xs text-[#646D7E]">Select a table</p>
        )}
      </Inspector>
    </div>
  );
}
