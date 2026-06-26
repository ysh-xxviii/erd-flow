"use client";

import { useState } from "react";
import {
  ACCENT_ORDER,
  SCHEMA_COLORS,
  categoryTag,
  tableColorHex,
  type ErdRelationship,
  type ErdTable,
  type SuggestedColumn,
  type SuggestedTable,
  type TableCategory,
} from "@/lib/types";
import { buildSchemaSnapshot } from "@/lib/schemaSnapshot";
import { SlideOver } from "./SlideOver";
import { COLUMN_TYPES } from "./useErd";

export function AiSuggestPanel({
  tables,
  relationships,
  onClose,
  onApply,
}: {
  tables: ErdTable[];
  relationships?: ErdRelationship[];
  onClose: () => void;
  onApply: (selected: SuggestedTable[]) => Promise<void>;
}) {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedTable[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [expandedPreview, setExpandedPreview] = useState<string | null>(null);
  const [customizing, setCustomizing] = useState<string | null>(null);

  const busy = loading || applying;
  const step = suggestions.length === 0 ? 1 : 2;

  function updateSuggestion(name: string, patch: Partial<SuggestedTable>) {
    setSuggestions((prev) =>
      prev.map((s) => (s.name === name ? { ...s, ...patch } : s))
    );
    if (patch.name && patch.name !== name) {
      setChecked((c) => {
        const next = { ...c };
        next[patch.name!] = next[name] ?? true;
        delete next[name];
        return next;
      });
      setExpandedPreview((e) => (e === name ? patch.name! : e));
      setCustomizing((c) => (c === name ? patch.name! : c));
    }
  }

  function updateColumn(
    tableName: string,
    colIndex: number,
    patch: Partial<SuggestedColumn>
  ) {
    setSuggestions((prev) =>
      prev.map((s) => {
        if (s.name !== tableName) return s;
        return {
          ...s,
          columns: s.columns.map((c, i) =>
            i === colIndex ? { ...c, ...patch } : c
          ),
        };
      })
    );
  }

  function addColumn(tableName: string) {
    setSuggestions((prev) =>
      prev.map((s) => {
        if (s.name !== tableName) return s;
        const n = s.columns.length + 1;
        return {
          ...s,
          columns: [
            ...s.columns,
            { name: `column_${n}`, data_type: "text", is_nullable: true },
          ],
        };
      })
    );
  }

  function removeColumn(tableName: string, colIndex: number) {
    setSuggestions((prev) =>
      prev.map((s) => {
        if (s.name !== tableName) return s;
        return {
          ...s,
          columns: s.columns.filter((_, i) => i !== colIndex),
        };
      })
    );
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setSuggestions([]);
    setExpandedPreview(null);
    setCustomizing(null);

    const schema = buildSchemaSnapshot(tables, relationships ?? []);

    try {
      const res = await fetch("/api/ai/suggest-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, schema }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");

      const list: SuggestedTable[] = json.suggestions ?? [];
      setSuggestions(list);
      setChecked(Object.fromEntries(list.map((s) => [s.name, true])));
      if (list.length === 0) {
        setError("No new tables suggested. Try adding more detail.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    const selected = suggestions.filter((s) => checked[s.name]);
    if (selected.length === 0) return;
    setApplying(true);
    setCustomizing(null);
    try {
      await onApply(selected);
    } finally {
      setApplying(false);
    }
  }

  const selectedCount = suggestions.filter((s) => checked[s.name]).length;

  return (
    <SlideOver onClose={onClose} backdropDisabled={applying}>
        {applying && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-surface/90 backdrop-blur-sm">
            <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-accent-purple border-t-transparent" />
            <p className="text-sm font-medium text-ink">
              Adding {selectedCount} table{selectedCount === 1 ? "" : "s"}…
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              Layout and JSON shapes are generated next
            </p>
          </div>
        )}

        <header className="border-b border-border-subtle p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b7bff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m12 3 1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
              </svg>
              <h2 className="text-base font-semibold text-ink">AI Suggest</h2>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              disabled={applying}
              aria-label="Close"
              className="cursor-pointer rounded-md p-1.5 text-ink-faint transition-colors hover:bg-card hover:text-ink disabled:opacity-50"
            >
              ×
            </button>
          </div>

          <div className="mt-3 flex gap-2 text-[10px]">
            <StepChip n={1} label="Describe" active={step === 1} done={step > 1} />
            <StepChip n={2} label="Review" active={step === 2} done={false} />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {step === 1 && (
            <>
              <label htmlFor="ai-desc" className="mb-1.5 block text-sm font-medium text-ink">
                What are you building?
              </label>
              <textarea
                id="ai-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                disabled={busy}
                placeholder="e.g. Social media manager with users, personas, posts, and analytics"
                className="w-full resize-none rounded-lg border border-border-subtle bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent-purple focus:outline-none disabled:opacity-60"
              />
              <p className="mt-2 text-xs leading-relaxed text-ink-faint">
                AI will suggest a full schema. You review it first, then add to
                the canvas. Edit tables on the canvas after they&apos;re added.
              </p>
              <button
                type="button"
                onClick={generate}
                disabled={busy}
                className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent-purple px-4 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-[#a294ff] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Generating schema…" : "Generate schema"}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs text-ink-muted">
                  {selectedCount} of {suggestions.length} selected
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setSuggestions([]);
                    setExpandedPreview(null);
                    setCustomizing(null);
                  }}
                  className="cursor-pointer text-xs text-accent-purple hover:underline disabled:opacity-50"
                >
                  Start over
                </button>
              </div>

              {(() => {
                const groups: { label: string; cat: TableCategory }[] = [
                  { label: "Core domain", cat: "core" },
                  { label: "Enums", cat: "enum" },
                  { label: "Framework / infra", cat: "framework" },
                ];
                return (
                  <div className="space-y-5">
                    {groups.map(({ label, cat }) => {
                      const items = suggestions.filter(
                        (s) => (s.category ?? "core") === cat
                      );
                      if (items.length === 0) return null;
                      return (
                        <div key={cat}>
                          <div className="mb-1.5 text-[10px] uppercase tracking-[1.5px] text-ink-faint">
                            {label}
                          </div>
                          <ul className="space-y-2">
                            {items.map((s, i) => (
                              <SuggestionCard
                                key={s.name}
                                s={s}
                                accent={tableColorHex({
                                  color: ACCENT_ORDER[i % ACCENT_ORDER.length],
                                  category: (s.category ?? "core") as TableCategory,
                                })}
                                checked={!!checked[s.name]}
                                previewOpen={expandedPreview === s.name}
                                customizing={customizing === s.name}
                                disabled={busy}
                                onToggle={(v) =>
                                  setChecked((c) => ({ ...c, [s.name]: v }))
                                }
                                onTogglePreview={() =>
                                  setExpandedPreview((e) =>
                                    e === s.name ? null : s.name
                                  )
                                }
                                onStartCustomize={() => {
                                  setCustomizing(s.name);
                                  setExpandedPreview(s.name);
                                }}
                                onDoneCustomize={() => setCustomizing(null)}
                                onUpdateTable={(patch) =>
                                  updateSuggestion(s.name, patch)
                                }
                                onUpdateColumn={(colIndex, patch) =>
                                  updateColumn(s.name, colIndex, patch)
                                }
                                onAddColumn={() => addColumn(s.name)}
                                onRemoveColumn={(colIndex) =>
                                  removeColumn(s.name, colIndex)
                                }
                              />
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </>
          )}

          {error && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300"
            >
              {error}
            </p>
          )}
        </div>

        {suggestions.length > 0 && (
          <footer className="border-t border-border-subtle bg-canvas/40 p-4">
            <p className="mb-3 text-[11px] leading-relaxed text-ink-faint">
              Happy with the preview? Add to canvas, then double-click any table
              to edit columns and relationships.
            </p>
            <button
              type="button"
              onClick={apply}
              disabled={busy || selectedCount === 0}
              className="flex w-full cursor-pointer items-center justify-center rounded-lg bg-accent-blue px-4 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-[#79b6ff] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add {selectedCount} table{selectedCount === 1 ? "" : "s"} to canvas
            </button>
          </footer>
        )}
    </SlideOver>
  );
}

function StepChip({
  n,
  label,
  active,
  done,
}: {
  n: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
        active
          ? "bg-accent-purple/15 text-accent-purple"
          : done
            ? "bg-accent-green/10 text-accent-green"
            : "bg-card text-ink-faint"
      }`}
    >
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-black/20 text-[9px] font-bold">
        {done ? "✓" : n}
      </span>
      <span className="font-medium">{label}</span>
    </div>
  );
}

function SuggestionCard({
  s,
  accent,
  checked,
  previewOpen,
  customizing,
  disabled,
  onToggle,
  onTogglePreview,
  onStartCustomize,
  onDoneCustomize,
  onUpdateTable,
  onUpdateColumn,
  onAddColumn,
  onRemoveColumn,
}: {
  s: SuggestedTable;
  accent: string;
  checked: boolean;
  previewOpen: boolean;
  customizing: boolean;
  disabled: boolean;
  onToggle: (v: boolean) => void;
  onTogglePreview: () => void;
  onStartCustomize: () => void;
  onDoneCustomize: () => void;
  onUpdateTable: (patch: Partial<SuggestedTable>) => void;
  onUpdateColumn: (colIndex: number, patch: Partial<SuggestedColumn>) => void;
  onAddColumn: () => void;
  onRemoveColumn: (colIndex: number) => void;
}) {
  const category = (s.category ?? "core") as TableCategory;

  return (
    <li
      className="overflow-hidden rounded-xl border bg-card transition-colors"
      style={{ borderColor: checked ? `${accent}66` : "#1f2940" }}
    >
      {/* Preview header — read only */}
      <div className="flex items-start gap-2.5 p-3">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="mt-1 h-4 w-4 cursor-pointer accent-accent-purple disabled:cursor-not-allowed"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 flex-none rounded-full"
              style={{ background: accent }}
            />
            <span className="truncate font-mono text-sm font-semibold text-ink">
              {s.name}
            </span>
            <span
              className="ml-auto flex-none rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide"
              style={{ color: accent, background: `${accent}22` }}
            >
              {categoryTag(category)}
            </span>
          </div>
          {s.reason && (
            <p className="mt-1 text-xs text-ink-muted">{s.reason}</p>
          )}
          <p className="mt-1 text-[11px] text-ink-faint">
            {s.columns.length} columns
            {s.relationships?.length
              ? ` · ${s.relationships.length} relationships`
              : ""}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={onTogglePreview}
              className="cursor-pointer text-[11px] font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
            >
              {previewOpen ? "Hide preview" : "Preview columns"}
            </button>
            {!customizing && (
              <button
                type="button"
                disabled={disabled}
                onClick={onStartCustomize}
                className="cursor-pointer text-[11px] font-medium text-accent-purple transition-colors hover:text-[#a294ff] disabled:opacity-50"
              >
                Adjust before adding →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Read-only column preview */}
      {previewOpen && !customizing && (
        <div className="border-t border-border-subtle/60 bg-canvas/40 px-3 py-2">
          {s.description && (
            <p className="mb-2 text-[11px] italic text-ink-faint">{s.description}</p>
          )}
          <div className="overflow-hidden rounded-lg border border-border-subtle">
            {s.columns.map((c, i) => (
              <div
                key={`${c.name}-${i}`}
                className="flex items-center gap-2 border-b border-border-subtle/60 px-2 py-1 font-mono text-[11px] last:border-b-0"
              >
                <span className="w-4 flex-none text-center">
                  {category !== "enum" && c.is_pk ? (
                    <span style={{ color: SCHEMA_COLORS.pk }}>◆</span>
                  ) : category !== "enum" && c.is_fk ? (
                    <span style={{ color: SCHEMA_COLORS.fk }}>◇</span>
                  ) : null}
                </span>
                <span className="flex-1 truncate text-ink">{c.name}</span>
                <span style={{ color: SCHEMA_COLORS.type }}>{c.data_type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customize panel — clearly separated */}
      {customizing && (
        <div className="border-t border-accent-purple/30 bg-accent-purple/5 px-3 py-3">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-accent-purple">
              Adjust before adding
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={onDoneCustomize}
              className="cursor-pointer rounded-md bg-accent-purple/15 px-2 py-0.5 text-[11px] font-semibold text-accent-purple hover:bg-accent-purple/25 disabled:opacity-50"
            >
              Done
            </button>
          </div>

          <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink-faint">
            Table name
          </label>
          <input
            value={s.name}
            disabled={disabled}
            onChange={(e) => onUpdateTable({ name: e.target.value })}
            className="mb-3 w-full rounded-md border border-border-subtle bg-canvas px-2 py-1.5 font-mono text-sm text-ink focus:border-accent-purple focus:outline-none disabled:opacity-60"
          />

          <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink-faint">
            Description
          </label>
          <textarea
            value={s.description ?? ""}
            disabled={disabled}
            onChange={(e) => onUpdateTable({ description: e.target.value })}
            rows={2}
            className="mb-3 w-full resize-none rounded-md border border-border-subtle bg-canvas px-2 py-1.5 text-[11px] text-ink focus:border-accent-purple focus:outline-none disabled:opacity-60"
          />

          <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink-faint">
            Columns
          </label>
          <div className="overflow-hidden rounded-lg border border-border-subtle">
            {s.columns.map((c, colIndex) => (
              <div
                key={`${c.name}-${colIndex}`}
                className="flex flex-wrap items-center gap-1.5 border-b border-border-subtle/60 px-2 py-1.5 last:border-b-0"
              >
                <input
                  value={c.name}
                  disabled={disabled}
                  onChange={(e) =>
                    onUpdateColumn(colIndex, { name: e.target.value })
                  }
                  className="min-w-[80px] flex-1 rounded border border-border-subtle bg-surface px-1.5 py-0.5 font-mono text-[11px] focus:border-accent-purple focus:outline-none disabled:opacity-60"
                />
                <select
                  value={c.data_type}
                  disabled={disabled}
                  onChange={(e) =>
                    onUpdateColumn(colIndex, { data_type: e.target.value })
                  }
                  className="cursor-pointer rounded border border-border-subtle bg-surface px-1 py-0.5 font-mono text-[10px] disabled:opacity-60"
                >
                  {COLUMN_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {category !== "enum" && (
                  <>
                    <ToggleChip
                      label="PK"
                      active={!!c.is_pk}
                      disabled={disabled}
                      onClick={() =>
                        onUpdateColumn(colIndex, {
                          is_pk: !c.is_pk,
                          is_nullable: c.is_pk ? c.is_nullable : false,
                        })
                      }
                    />
                    <ToggleChip
                      label="FK"
                      active={!!c.is_fk}
                      disabled={disabled}
                      onClick={() =>
                        onUpdateColumn(colIndex, { is_fk: !c.is_fk })
                      }
                    />
                  </>
                )}
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`Remove ${c.name}`}
                  onClick={() => onRemoveColumn(colIndex)}
                  className="cursor-pointer px-1 text-ink-faint hover:text-red-300 disabled:opacity-50"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={onAddColumn}
            className="mt-2 cursor-pointer text-[11px] font-medium text-accent-blue hover:underline disabled:opacity-50"
          >
            + Add column
          </button>
        </div>
      )}
    </li>
  );
}

function ToggleChip({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`cursor-pointer rounded px-1.5 py-0.5 text-[9px] font-bold disabled:opacity-50 ${
        active
          ? "bg-accent-blue/20 text-accent-blue"
          : "bg-surface text-ink-faint"
      }`}
    >
      {label}
    </button>
  );
}
