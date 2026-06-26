"use client";

import { useEffect, useMemo, useState } from "react";
import type { ErdRelationship, ErdTable } from "@/lib/types";
import {
  buildSnapshot,
  generateCreateSql,
  generateDiffSql,
} from "@/lib/sqlGenerator";
import {
  createMigration,
  deleteMigration,
  listMigrations,
  migrationFilename,
  nextVersion,
  type DiagramMigration,
} from "@/lib/migrations";
import { SlideOver } from "./SlideOver";

type Tab = "current" | "history";

function downloadSql(filename: string, sql: string) {
  const blob = new Blob([sql], { type: "text/sql;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function MigrationsPanel({
  diagramId,
  diagramName,
  tables,
  relationships,
  onClose,
}: {
  diagramId: string;
  diagramName: string;
  tables: ErdTable[];
  relationships: ErdRelationship[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("current");
  const [migrations, setMigrations] = useState<DiagramMigration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"diff" | "full">("diff");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const snapshot = useMemo(
    () => buildSnapshot(tables, relationships),
    [tables, relationships]
  );

  const latest = migrations[0] ?? null;
  const version = nextVersion(latest);

  const currentSql = useMemo(() => {
    if (mode === "full" || !latest) return generateCreateSql(snapshot);
    return generateDiffSql(latest.snapshot, snapshot);
  }, [mode, latest, snapshot]);

  const hasChanges = !/^-- No schema changes/.test(currentSql);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listMigrations(diagramId)
      .then((rows) => {
        if (active) setMigrations(rows);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [diagramId]);

  async function copy(key: string, sql: string) {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      setError("Clipboard unavailable in this browser.");
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const finalName = name.trim() || `schema_v${version}`;
      const created = await createMigration(diagramId, {
        name: finalName,
        sql: currentSql,
        snapshot,
        version,
      });
      setMigrations((prev) => [created, ...prev]);
      setName("");
      setMode("diff");
      setTab("history");
      setExpandedId(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    const prev = migrations;
    setMigrations((m) => m.filter((x) => x.id !== id));
    try {
      await deleteMigration(id);
    } catch (e) {
      setMigrations(prev);
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  function downloadAll() {
    const ordered = [...migrations].sort((a, b) => a.version - b.version);
    const body = ordered
      .map(
        (m) =>
          `-- ${migrationFilename(m.version, m.name)}\n-- saved ${new Date(
            m.created_at
          ).toLocaleString()}\n\n${m.sql}`
      )
      .join("\n\n-- ===========================================================\n\n");
    const slug = diagramName.toLowerCase().replace(/[^a-z0-9]+/g, "_") || "schema";
    downloadSql(`${slug}_migrations.sql`, body);
  }

  return (
    <SlideOver onClose={onClose}>
        <header className="border-b border-border-subtle p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5aa6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <ellipse cx="12" cy="5" rx="8" ry="3" />
                <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
                <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
              </svg>
              <h2 className="text-base font-semibold text-ink">Migrations</h2>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              aria-label="Close"
              className="cursor-pointer rounded-md p-1.5 text-ink-faint transition-colors hover:bg-card hover:text-ink"
            >
              ×
            </button>
          </div>

          <div className="mt-3 flex gap-1 rounded-lg bg-card p-1 text-xs">
            <TabButton active={tab === "current"} onClick={() => setTab("current")}>
              Current
            </TabButton>
            <TabButton active={tab === "history"} onClick={() => setTab("history")}>
              History {migrations.length > 0 ? `(${migrations.length})` : ""}
            </TabButton>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <p
              role="alert"
              className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
            >
              {error}
            </p>
          )}

          {tab === "current" && (
            <>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex gap-1 rounded-md border border-border-subtle bg-card p-0.5 text-[11px]">
                  <ModeButton active={mode === "diff"} onClick={() => setMode("diff")}>
                    {latest ? `Diff since v${latest.version}` : "Diff"}
                  </ModeButton>
                  <ModeButton active={mode === "full"} onClick={() => setMode("full")}>
                    Full schema
                  </ModeButton>
                </div>
                <span className="text-[11px] text-ink-faint">
                  {snapshot.tables.length} tables · {snapshot.fks.length} FKs
                </span>
              </div>

              <pre className="max-h-[45vh] overflow-auto rounded-lg border border-border-subtle bg-canvas p-3 font-mono text-[11px] leading-relaxed text-ink">
                {currentSql}
              </pre>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => copy("current", currentSql)}
                  className="flex-1 cursor-pointer rounded-lg border border-border-subtle bg-card px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-[#1b2540]"
                >
                  {copied === "current" ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadSql(migrationFilename(version, name || "schema"), currentSql)
                  }
                  className="flex-1 cursor-pointer rounded-lg border border-border-subtle bg-card px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-[#1b2540]"
                >
                  Download .sql
                </button>
              </div>

              <div className="mt-4 rounded-lg border border-border-subtle bg-canvas/40 p-3">
                <label
                  htmlFor="mig-name"
                  className="mb-1 block text-[10px] uppercase tracking-wide text-ink-faint"
                >
                  Save as migration v{version}
                </label>
                <input
                  id="mig-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`e.g. add_orders (default schema_v${version})`}
                  disabled={saving}
                  className="mb-2 w-full rounded-md border border-border-subtle bg-canvas px-2 py-1.5 font-mono text-xs text-ink placeholder:text-ink-faint focus:border-accent-blue focus:outline-none disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || snapshot.tables.length === 0 || (!hasChanges && mode === "diff")}
                  className="w-full cursor-pointer rounded-lg bg-accent-blue px-4 py-2 text-xs font-semibold text-canvas transition-colors hover:bg-[#79b6ff] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving…"
                    : !hasChanges && mode === "diff"
                      ? "No changes to save"
                      : `Save migration v${version}`}
                </button>
              </div>
            </>
          )}

          {tab === "history" && (
            <>
              {loading ? (
                <p className="text-sm text-ink-faint">Loading history…</p>
              ) : migrations.length === 0 ? (
                <p className="text-sm text-ink-faint">
                  No migrations saved yet. Generate SQL on the Current tab and save
                  your first version.
                </p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={downloadAll}
                    className="mb-3 cursor-pointer text-xs font-medium text-accent-blue hover:underline"
                  >
                    Download all ({migrations.length})
                  </button>
                  <ul className="space-y-2">
                    {migrations.map((m) => {
                      const open = expandedId === m.id;
                      return (
                        <li
                          key={m.id}
                          className="overflow-hidden rounded-xl border border-border-subtle bg-card"
                        >
                          <div className="flex items-center gap-2 p-3">
                            <span className="flex-none rounded bg-accent-blue/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent-blue">
                              v{m.version}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-mono text-sm text-ink">
                                {m.name}
                              </p>
                              <p className="text-[10px] text-ink-faint">
                                {new Date(m.created_at).toLocaleString()}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setExpandedId((e) => (e === m.id ? null : m.id))}
                              className="cursor-pointer rounded-md px-2 py-1 text-[11px] text-ink-muted hover:text-ink"
                            >
                              {open ? "Hide" : "View"}
                            </button>
                            <button
                              type="button"
                              onClick={() => copy(m.id, m.sql)}
                              className="cursor-pointer rounded-md px-2 py-1 text-[11px] text-ink-muted hover:text-ink"
                            >
                              {copied === m.id ? "Copied" : "Copy"}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                downloadSql(migrationFilename(m.version, m.name), m.sql)
                              }
                              className="cursor-pointer rounded-md px-2 py-1 text-[11px] text-ink-muted hover:text-ink"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(m.id)}
                              aria-label={`Delete ${m.name}`}
                              className="cursor-pointer rounded-md px-2 py-1 text-[11px] text-ink-faint hover:text-red-300"
                            >
                              ×
                            </button>
                          </div>
                          {open && (
                            <pre className="max-h-[40vh] overflow-auto border-t border-border-subtle bg-canvas p-3 font-mono text-[11px] leading-relaxed text-ink">
                              {m.sql}
                            </pre>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
    </SlideOver>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 cursor-pointer rounded-md px-3 py-1.5 font-medium transition-colors ${
        active ? "bg-accent-blue/15 text-accent-blue" : "text-ink-faint hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded px-2 py-1 font-medium transition-colors ${
        active ? "bg-accent-blue/20 text-accent-blue" : "text-ink-faint hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
