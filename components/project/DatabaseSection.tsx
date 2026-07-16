"use client";

import { useCallback, useEffect, useState } from "react";
import type { ErdTable } from "@/lib/types";
import { useProjectStore } from "@/lib/projectStore";
import { usePendingChanges } from "@/lib/pendingChanges";
import { NotConnectedState } from "./NotConnectedState";
import { Inspector } from "./Inspector";

type GridState = {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
};

export function DatabaseSection({
  tables,
  diagramId,
}: {
  tables: ErdTable[];
  diagramId: string;
}) {
  const {
    isFullyConnected,
    dbConnected,
    dbHost,
    dbName,
    setModal,
    selectedTableId,
    setSelectedTableId,
    requestProdGate,
    env,
  } = useProjectStore();
  const { addChange, pushToast } = usePendingChanges();
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [grid, setGrid] = useState<GridState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiSql, setAiSql] = useState("");
  const [sqlResult, setSqlResult] = useState<GridState | null>(null);
  const [bulkPrompt, setBulkPrompt] = useState("");
  const [editCell, setEditCell] = useState<{
    rowIndex: number;
    col: string;
  } | null>(null);
  const [dirtySql, setDirtySql] = useState<string[]>([]);

  const activeTable =
    tables.find((t) => t.id === (selectedTableId ?? openTabs[0])) ?? null;

  const loadTable = useCallback(
    async (tableName: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/db/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ diagramId, table: tableName }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Query failed");
        setGrid({
          columns: data.columns,
          rows: data.rows,
          rowCount: data.rowCount ?? data.rows.length,
        });
        setDirtySql([]);
      } catch (e) {
        setGrid(null);
        setError(e instanceof Error ? e.message : "Query failed");
      } finally {
        setLoading(false);
      }
    },
    [diagramId]
  );

  useEffect(() => {
    if (tables[0] && !selectedTableId) setSelectedTableId(tables[0].id);
  }, [tables, selectedTableId, setSelectedTableId]);

  useEffect(() => {
    if (!activeTable || !dbConnected) return;
    setOpenTabs((tabs) =>
      tabs.includes(activeTable.id) ? tabs : [...tabs, activeTable.id]
    );
    void loadTable(activeTable.name);
  }, [activeTable?.id, activeTable?.name, dbConnected, loadTable]);

  if (!dbConnected && !isFullyConnected) {
    return (
      <div className="flex h-full flex-1">
        <NotConnectedState
          title="Database not connected"
          detail="Connect a live Postgres database to browse and edit rows."
        />
      </div>
    );
  }

  if (!dbConnected) {
    return (
      <div className="flex h-full flex-1">
        <NotConnectedState
          title="Connect Postgres"
          detail="A real connection string is required. Demo overrides do not unlock the live grid."
        />
      </div>
    );
  }

  function quoteIdent(name: string) {
    return `"${name.replace(/"/g, '""')}"`;
  }

  function quoteValue(v: unknown): string {
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    return `'${String(v).replace(/'/g, "''")}'`;
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
            live
          </div>
          <button
            type="button"
            onClick={() => setModal("editDb")}
            className="mt-2 cursor-pointer text-[11px] text-[#6E9BF5]"
          >
            Update connection
          </button>
        </div>
        <div className="border-b border-[#2E333D] px-3 py-2 text-[10px] uppercase text-[#646D7E]">
          Tables (from ERD)
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
            </button>
          ))}
        </div>
        <div className="border-t border-[#2E333D] p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase text-[#B48CF2]">
            ✦ AI SQL
          </p>
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="e.g. pending orders older than 30 days"
            rows={2}
            className="w-full rounded border border-[#2E333D] bg-[#111318] p-2 text-[11px] text-[#E7EAF0]"
          />
          <button
            type="button"
            onClick={() => {
              if (!activeTable) return;
              const p = aiPrompt.toLowerCase();
              let sql = `SELECT * FROM ${activeTable.name} LIMIT 50`;
              if (p.includes("count"))
                sql = `SELECT count(*) FROM ${activeTable.name}`;
              else if (p.includes("pending"))
                sql = `SELECT * FROM ${activeTable.name} WHERE status = 'pending' LIMIT 50`;
              else if (p.includes("30"))
                sql = `SELECT * FROM ${activeTable.name} WHERE created_at < now() - interval '30 days' LIMIT 50`;
              setAiSql(sql);
            }}
            className="mt-2 w-full cursor-pointer rounded bg-[#B48CF2]/20 py-1 text-[11px] font-semibold text-[#B48CF2]"
          >
            Generate SQL
          </button>
          {aiSql && (
            <>
              <textarea
                value={aiSql}
                onChange={(e) => setAiSql(e.target.value)}
                rows={3}
                className="mt-2 w-full rounded border border-[#B48CF2]/30 bg-[#111318] p-2 font-mono text-[10px] text-[#B48CF2]"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/db/query", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ diagramId, sql: aiSql }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Failed");
                    setSqlResult({
                      columns: data.columns,
                      rows: data.rows,
                      rowCount: data.rows.length,
                    });
                    pushToast("Query ran", `${data.rows.length} row(s)`);
                  } catch (e) {
                    pushToast(
                      "Query failed",
                      e instanceof Error ? e.message : "Error"
                    );
                  }
                }}
                className="mt-1 w-full cursor-pointer rounded border border-[#2E333D] py-1 text-[11px] text-[#9AA3B2]"
              >
                Run SELECT
              </button>
            </>
          )}
          <textarea
            value={bulkPrompt}
            onChange={(e) => setBulkPrompt(e.target.value)}
            placeholder="Bulk UPDATE SQL…"
            rows={2}
            className="mt-3 w-full rounded border border-[#2E333D] bg-[#111318] p-2 text-[11px] text-[#E7EAF0]"
          />
          <button
            type="button"
            onClick={() => {
              if (!bulkPrompt.trim()) return;
              addChange({
                kind: "db_row",
                summary: bulkPrompt.slice(0, 120),
                label: activeTable?.name ?? "sql",
                payload: { sql: bulkPrompt },
                diffHint: "modified",
              });
              pushToast("Queued for plan", "Save to plan, then Approve & ship.");
              setBulkPrompt("");
            }}
            className="mt-2 w-full cursor-pointer rounded bg-[#D9A03F]/15 py-1 text-[11px] font-semibold text-[#D9A03F]"
          >
            Queue SQL in plan
          </button>
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

        {sqlResult && (
          <div className="border-b border-[#B48CF2]/30 bg-[#15181E] p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] text-[#B48CF2]">SQL result</span>
              <button
                type="button"
                className="text-[10px] text-[#646D7E]"
                onClick={() => setSqlResult(null)}
              >
                Close
              </button>
            </div>
            <DataTable
              columns={sqlResult.columns}
              rows={sqlResult.rows}
              readOnly
            />
          </div>
        )}

        {!activeTable ? (
          <div className="flex flex-1 items-center justify-center text-sm text-[#646D7E]">
            Select a table
          </div>
        ) : loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-[#646D7E]">
            Loading…
          </div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-sm text-[#C25E5E]">{error}</p>
            <p className="text-xs text-[#646D7E]">
              Table may not exist on the customer DB yet — ship a schema plan
              first.
            </p>
            <button
              type="button"
              onClick={() => void loadTable(activeTable.name)}
              className="cursor-pointer text-xs text-[#6E9BF5]"
            >
              Retry
            </button>
          </div>
        ) : grid ? (
          <div className="min-h-0 flex-1 overflow-auto">
            <DataTable
              columns={grid.columns}
              rows={grid.rows}
              pkCols={
                new Set(
                  activeTable.columns.filter((c) => c.is_pk).map((c) => c.name)
                )
              }
              editCell={editCell}
              setEditCell={setEditCell}
              onCellCommit={(rowIndex, col, value) => {
                const row = grid.rows[rowIndex];
                if (!row) return;
                const pk = activeTable.columns.find((c) => c.is_pk);
                if (!pk) {
                  pushToast("No PK", "Cannot build UPDATE without a primary key");
                  return;
                }
                const sql = `UPDATE ${quoteIdent(activeTable.name)} SET ${quoteIdent(col)} = ${quoteValue(value)} WHERE ${quoteIdent(pk.name)} = ${quoteValue(row[pk.name])}`;
                setDirtySql((prev) => [...prev, sql]);
                setGrid((g) => {
                  if (!g) return g;
                  const rows = g.rows.map((r, i) =>
                    i === rowIndex ? { ...r, [col]: value } : r
                  );
                  return { ...g, rows };
                });
              }}
            />
            <div className="flex gap-2 border-t border-[#2E333D] p-2">
              <span className="text-[11px] text-[#646D7E]">
                {grid.rowCount} rows · showing {grid.rows.length}
                {dirtySql.length > 0 ? ` · ${dirtySql.length} dirty` : ""}
              </span>
              <div className="flex-1" />
              <button
                type="button"
                disabled={dirtySql.length === 0}
                onClick={() =>
                  requestProdGate(() => {
                    addChange({
                      kind: "db_row",
                      summary: `Update ${dirtySql.length} cell(s) on ${activeTable.name}`,
                      label: activeTable.name,
                      payload: { sql: dirtySql.join(";\n") },
                      diffHint: "modified",
                    });
                    setDirtySql([]);
                    pushToast(
                      "Queued cell updates",
                      "Save to plan, then Approve & ship to apply."
                    );
                  })
                }
                className="cursor-pointer rounded bg-[#4EB3A5] px-2 py-1 text-[11px] font-semibold text-[#111318] disabled:opacity-40"
              >
                Queue dirty cells
              </button>
              <button
                type="button"
                onClick={() => void loadTable(activeTable.name)}
                className="cursor-pointer rounded border border-[#2E333D] px-2 py-1 text-[11px] text-[#9AA3B2]"
              >
                Refresh
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <Inspector title={activeTable?.name ?? "Database"} breadcrumb={`Database · ${env}`}>
        {activeTable ? (
          <div className="space-y-2 text-xs text-[#9AA3B2]">
            <p>Live Postgres via encrypted connection.</p>
            <p>{activeTable.columns.length} columns in ERD</p>
            <p className="text-[10px] text-[#646D7E]">
              Cell edits queue SQL into a plan. Approve & ship applies them in a
              transaction (prod-gated on the server).
            </p>
          </div>
        ) : (
          <p className="text-xs text-[#646D7E]">Select a table</p>
        )}
      </Inspector>
    </div>
  );
}

function DataTable({
  columns,
  rows,
  pkCols,
  readOnly,
  editCell,
  setEditCell,
  onCellCommit,
}: {
  columns: string[];
  rows: Record<string, unknown>[];
  pkCols?: Set<string>;
  readOnly?: boolean;
  editCell?: { rowIndex: number; col: string } | null;
  setEditCell?: (v: { rowIndex: number; col: string } | null) => void;
  onCellCommit?: (rowIndex: number, col: string, value: string) => void;
}) {
  return (
    <table className="w-full border-collapse text-left text-xs">
      <thead className="sticky top-0 bg-[#15181E]">
        <tr>
          {columns.map((c) => (
            <th
              key={c}
              className="border-b border-[#2E333D] px-2 py-2 font-mono text-[10px] font-normal text-[#646D7E]"
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex} className="hover:bg-[#1A1D23]/50">
            {columns.map((c) => {
              const isPk = pkCols?.has(c);
              const editing =
                !readOnly &&
                editCell?.rowIndex === rowIndex &&
                editCell.col === c;
              return (
                <td
                  key={c}
                  onDoubleClick={() => {
                    if (readOnly || isPk) return;
                    setEditCell?.({ rowIndex, col: c });
                  }}
                  className={`border-b border-[#2E333D]/60 px-2 py-1.5 font-mono text-[11px] ${
                    isPk ? "text-[#646D7E]" : "cursor-text text-[#E7EAF0]"
                  }`}
                >
                  {editing ? (
                    <input
                      autoFocus
                      defaultValue={String(row[c] ?? "")}
                      className="w-full bg-transparent outline-none"
                      onBlur={(e) => {
                        onCellCommit?.(rowIndex, c, e.target.value);
                        setEditCell?.(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setEditCell?.(null);
                      }}
                    />
                  ) : row[c] === null || row[c] === undefined ? (
                    <span className="text-[#646D7E]">NULL</span>
                  ) : (
                    String(row[c])
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
