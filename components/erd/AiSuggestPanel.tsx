"use client";

import { useState } from "react";
import {
  ACCENT_ORDER,
  SCHEMA_COLORS,
  categoryTag,
  tableColorHex,
  type ErdTable,
  type SchemaSnapshot,
  type SuggestedTable,
  type TableCategory,
} from "@/lib/types";

export function AiSuggestPanel({
  tables,
  onClose,
  onApply,
}: {
  tables: ErdTable[];
  onClose: () => void;
  onApply: (selected: SuggestedTable[]) => Promise<void>;
}) {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedTable[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  async function generate() {
    setLoading(true);
    setError(null);
    setSuggestions([]);

    const schema: SchemaSnapshot = {
      tables: tables.map((t) => ({
        name: t.name,
        columns: t.columns.map((c) => ({
          name: c.name,
          data_type: c.data_type,
          is_pk: c.is_pk,
          is_fk: c.is_fk,
        })),
      })),
    };

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
    try {
      await onApply(selected);
    } finally {
      setApplying(false);
    }
  }

  const selectedCount = suggestions.filter((s) => checked[s.name]).length;

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label="Close AI panel"
        onClick={onClose}
        className="flex-1 cursor-pointer bg-black/50 backdrop-blur-sm"
      />
      <aside className="flex h-full w-full max-w-md flex-col border-l border-border-subtle bg-surface shadow-2xl">
        <header className="flex items-center justify-between border-b border-border-subtle p-4">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b7bff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m12 3 1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
              <path d="M19 14v4M21 16h-4" />
            </svg>
            <h2 className="text-base font-semibold text-ink">
              AI Table Suggestions
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-md p-1.5 text-ink-faint transition-colors hover:bg-card hover:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          <label
            htmlFor="ai-desc"
            className="mb-1.5 block text-sm font-medium text-ink"
          >
            Describe your app (optional)
          </label>
          <textarea
            id="ai-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="e.g. A SaaS project management tool with teams, projects, tasks and comments"
            className="w-full resize-none rounded-lg border border-border-subtle bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent-purple focus:outline-none"
          />
          <p className="mt-1.5 text-xs text-ink-faint">
            We&apos;ll consider your {tables.length} existing table
            {tables.length === 1 ? "" : "s"} and suggest related ones.
          </p>

          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent-purple px-4 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-[#a294ff] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Thinking…" : "Generate suggestions"}
          </button>

          {error && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300"
            >
              {error}
            </p>
          )}

          {suggestions.length > 0 &&
            (() => {
              const groups: { label: string; cat: TableCategory }[] = [
                { label: "Core domain", cat: "core" },
                { label: "Enums", cat: "enum" },
                { label: "Framework / infra", cat: "framework" },
              ];
              return (
                <div className="mt-4 space-y-5">
                  {groups.map(({ label, cat }) => {
                    const items = suggestions.filter(
                      (s) => (s.category ?? "core") === cat
                    );
                    if (items.length === 0) return null;
                    return (
                      <div key={cat}>
                        <div className="mb-1.5 text-[10px] uppercase tracking-[1.5px] text-ink-faint">
                          {label}
                          <span className="ml-1.5 text-ink-faint/60">
                            {items.length}
                          </span>
                        </div>
                        <ul className="space-y-2.5">
                          {items.map((s, i) => (
                            <SuggestionCard
                              key={s.name}
                              s={s}
                              accent={tableColorHex({
                                color: ACCENT_ORDER[i % ACCENT_ORDER.length],
                                category: (s.category ?? "core") as TableCategory,
                              })}
                              checked={!!checked[s.name]}
                              onToggle={(v) =>
                                setChecked((c) => ({ ...c, [s.name]: v }))
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
        </div>

        {suggestions.length > 0 && (
          <footer className="border-t border-border-subtle p-4">
            <button
              type="button"
              onClick={apply}
              disabled={applying || selectedCount === 0}
              className="flex w-full cursor-pointer items-center justify-center rounded-lg bg-accent-blue px-4 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-[#79b6ff] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {applying
                ? "Adding…"
                : `Add ${selectedCount} table${selectedCount === 1 ? "" : "s"} to canvas`}
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}

function SuggestionCard({
  s,
  accent,
  checked,
  onToggle,
}: {
  s: SuggestedTable;
  accent: string;
  checked: boolean;
  onToggle: (v: boolean) => void;
}) {
  const category = (s.category ?? "core") as TableCategory;
  return (
    <li
      className="rounded-xl border bg-card p-3 transition-colors"
      style={{ borderColor: checked ? `${accent}88` : "#1f2940" }}
    >
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          className="mt-0.5 h-4 w-4 cursor-pointer accent-accent-purple"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: accent }}
            />
            <span className="truncate font-mono text-sm font-semibold text-ink">
              {s.name}
            </span>
            <span
              className="ml-auto rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide"
              style={{ color: accent, background: `${accent}22` }}
            >
              {categoryTag(category)}
            </span>
          </div>
          {s.reason && (
            <p className="mt-1 text-xs text-ink-muted">{s.reason}</p>
          )}
          {s.description && (
            <p className="mt-1 text-[11px] italic text-ink-faint">
              {s.description}
            </p>
          )}

          <div className="mt-2 overflow-hidden rounded-lg border border-border-subtle">
            {s.columns.map((c) => (
              <div
                key={c.name}
                className="flex items-center gap-2 border-b border-border-subtle/60 px-2 py-1 font-mono text-[11px] last:border-b-0"
              >
                <span className="w-6 flex-none">
                  {category !== "enum" && c.is_pk ? (
                    <span style={{ color: SCHEMA_COLORS.pk }}>◆</span>
                  ) : category !== "enum" && c.is_fk ? (
                    <span style={{ color: SCHEMA_COLORS.fk }}>◇</span>
                  ) : null}
                </span>
                <span className="flex-1 truncate text-ink">
                  {c.name}
                  {category !== "enum" && c.is_nullable ? (
                    <span className="text-ink-faint">?</span>
                  ) : null}
                </span>
                <span className="flex flex-none items-center gap-1.5">
                  {c.label && (
                    <span className="text-ink-faint">{c.label}</span>
                  )}
                  <span style={{ color: SCHEMA_COLORS.type }}>{c.data_type}</span>
                  {c.default_value && (
                    <span className="text-ink-faint">{c.default_value}</span>
                  )}
                </span>
              </div>
            ))}
          </div>

          {s.constraints && s.constraints.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {s.constraints.map((c) => (
                <span
                  key={`${c.kind}-${c.columns.join("-")}`}
                  className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-faint"
                >
                  {c.kind === "unique" ? "UQ" : "IDX"} ({c.columns.join(", ")})
                </span>
              ))}
            </div>
          )}

          {/* relationships */}
          {s.relationships && s.relationships.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {s.relationships.map((r, i) => (
                <p
                  key={`${r.to_table}-${r.from_column}-${i}`}
                  className="font-mono text-[10.5px] text-ink-faint"
                >
                  <span style={{ color: SCHEMA_COLORS.fk }}>
                    {r.from_column}
                  </span>{" "}
                  → {r.to_table}
                  <span className="ml-1 text-ink-faint/70">
                    ({r.cardinality})
                  </span>
                </p>
              ))}
            </div>
          )}
        </div>
      </label>
    </li>
  );
}
