"use client";

import { useEffect, useRef, useState } from "react";
import {
  ACCENT_HEX,
  ACCENT_ORDER,
  type AccentColor,
  type Cardinality,
  type ErdConstraint,
  type ErdColumn,
  type ErdTable,
} from "@/lib/types";
import { COLUMN_TYPES, type useErd } from "./useErd";
import { isJsonColumn } from "@/lib/jsonShapes";
import { needsJsonShapeGeneration } from "@/lib/jsonShapeAi";

type Erd = ReturnType<typeof useErd>;

const CARDINALITIES: Cardinality[] = [
  "one-to-one",
  "one-to-many",
  "many-to-many",
];

export function TableEditorDrawer({
  erd,
  tableId,
  onClose,
}: {
  erd: Erd;
  tableId: string;
  onClose: () => void;
}) {
  const table = erd.tables.find((t) => t.id === tableId);
  if (!table) return null;

  return (
    <aside className="flex h-full w-[380px] flex-none flex-col border-l border-[#1d2740] bg-[#0c111c]">
      <div className="flex h-12 flex-none items-center justify-between border-b border-[#1d2740] px-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-2.5 w-2.5 flex-none rounded-[3px]"
              style={{ background: ACCENT_HEX[table.color] }}
            />
            <span className="truncate font-mono text-[13px] font-semibold text-ink">
              {table.name}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-[#5e6a85]">
            Changes save automatically
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close editor"
          className="flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md text-lg text-[#7e8aa6] transition-colors hover:bg-card hover:text-ink"
        >
          ×
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <TableEditor erd={erd} table={table} onDeleted={onClose} />
      </div>
    </aside>
  );
}

function TableEditor({
  erd,
  table,
  onDeleted,
}: {
  erd: Erd;
  table: ErdTable;
  onDeleted: () => void;
}) {
  return (
    <section className="p-4">
      <div className="mb-4">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Table name
        </label>
        <input
          value={table.name}
          onChange={(e) => erd.renameTable(table.id, e.target.value)}
          className="w-full rounded-md border border-border-subtle bg-canvas px-2.5 py-1.5 font-mono text-sm text-ink focus:border-accent-blue focus:outline-none"
        />
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {ACCENT_ORDER.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Set color ${c}`}
                onClick={() => erd.setTableColor(table.id, c as AccentColor)}
                className="h-5 w-5 cursor-pointer rounded-full transition-transform hover:scale-110"
                style={{
                  background: ACCENT_HEX[c],
                  outline:
                    table.color === c ? `2px solid ${ACCENT_HEX[c]}` : "none",
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              erd.deleteTable(table.id);
              onDeleted();
            }}
            className="cursor-pointer rounded-md border border-red-500/30 px-2.5 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/15"
          >
            Delete table
          </button>
        </div>
      </div>

      <div className="mb-4">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Description
        </label>
        <textarea
          value={table.description}
          onChange={(e) =>
            erd.updateTableMeta(table.id, { description: e.target.value })
          }
          rows={2}
          placeholder="Short description shown under the table header"
          className="w-full resize-none rounded-md border border-border-subtle bg-canvas px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent-blue focus:outline-none"
        />
      </div>

      <ConstraintsEditor erd={erd} table={table} />

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
        Columns
      </h3>
      <ul className="space-y-2">
        {table.columns.map((col) => (
          <li
            key={col.id}
            className="rounded-lg border border-border-subtle bg-canvas p-2"
          >
            <div className="flex items-center gap-2">
              <input
                value={col.name}
                onChange={(e) =>
                  erd.updateColumn(table.id, col.id, { name: e.target.value })
                }
                className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 font-mono text-sm text-ink hover:border-border-subtle focus:border-accent-blue focus:outline-none"
              />
              <button
                type="button"
                aria-label={`Delete column ${col.name}`}
                onClick={() => erd.deleteColumn(table.id, col.id)}
                className="cursor-pointer rounded p-1 text-ink-faint transition-colors hover:bg-red-500/15 hover:text-red-300"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={col.data_type}
                onChange={(e) =>
                  erd.updateColumn(table.id, col.id, {
                    data_type: e.target.value,
                  })
                }
                aria-label="Data type"
                className="cursor-pointer rounded border border-border-subtle bg-surface px-1.5 py-1 font-mono text-xs text-ink-muted focus:border-accent-blue focus:outline-none"
              >
                {COLUMN_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <Toggle
                label="PK"
                active={col.is_pk}
                onClick={() =>
                  erd.updateColumn(table.id, col.id, {
                    is_pk: !col.is_pk,
                    is_nullable: col.is_pk ? col.is_nullable : false,
                  })
                }
              />
              <Toggle
                label="FK"
                active={col.is_fk}
                onClick={() =>
                  erd.updateColumn(table.id, col.id, { is_fk: !col.is_fk })
                }
              />
              <Toggle
                label="NULL"
                active={col.is_nullable}
                onClick={() =>
                  erd.updateColumn(table.id, col.id, {
                    is_nullable: !col.is_nullable,
                  })
                }
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={col.default_value ?? ""}
                onChange={(e) =>
                  erd.updateColumn(table.id, col.id, {
                    default_value: e.target.value || null,
                  })
                }
                placeholder="default"
                aria-label="Default value"
                className="w-24 rounded border border-border-subtle bg-surface px-1.5 py-1 font-mono text-xs text-ink-muted placeholder:text-ink-faint focus:border-accent-blue focus:outline-none"
              />
              {table.category === "enum" && (
                <input
                  value={col.label ?? ""}
                  onChange={(e) =>
                    erd.updateColumn(table.id, col.id, {
                      label: e.target.value || null,
                    })
                  }
                  placeholder="label"
                  aria-label="Enum label"
                  className="w-24 rounded border border-border-subtle bg-surface px-1.5 py-1 font-mono text-xs text-ink-muted placeholder:text-ink-faint focus:border-accent-blue focus:outline-none"
                />
              )}
            </div>
            {isJsonColumn(col) && (
              <JsonShapeAiFields erd={erd} table={table} col={col} />
            )}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => erd.addColumn(table.id)}
        className="mt-3 w-full cursor-pointer rounded-lg border border-dashed border-border-subtle px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:border-accent-blue/50 hover:text-ink"
      >
        + Add column
      </button>

      <RelationshipEditor erd={erd} table={table} />
    </section>
  );
}

function ConstraintsEditor({ erd, table }: { erd: Erd; table: ErdTable }) {
  const [kind, setKind] = useState<ErdConstraint["kind"]>("unique");
  const [cols, setCols] = useState("");

  function addConstraint(e: React.FormEvent) {
    e.preventDefault();
    const columns = cols
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    if (columns.length === 0) return;
    erd.updateTableMeta(table.id, {
      constraints: [...table.constraints, { kind, columns }],
    });
    setCols("");
  }

  function removeConstraint(index: number) {
    erd.updateTableMeta(table.id, {
      constraints: table.constraints.filter((_, i) => i !== index),
    });
  }

  return (
    <div className="mb-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
        Constraints
      </h3>
      {table.constraints.length > 0 && (
        <ul className="mb-2 space-y-1">
          {table.constraints.map((c, i) => (
            <li
              key={`${c.kind}-${c.columns.join("-")}-${i}`}
              className="flex items-center gap-2 rounded-md bg-canvas px-2 py-1.5 font-mono text-xs text-ink-muted"
            >
              <span className="text-ink-faint">
                {c.kind === "unique" ? "UQ" : "IDX"}
              </span>
              ({c.columns.join(", ")})
              <button
                type="button"
                aria-label="Remove constraint"
                onClick={() => removeConstraint(i)}
                className="ml-auto cursor-pointer text-ink-faint hover:text-red-300"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={addConstraint} className="flex gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as ErdConstraint["kind"])}
          aria-label="Constraint kind"
          className="cursor-pointer rounded border border-border-subtle bg-surface px-2 py-1 text-xs text-ink focus:border-accent-blue focus:outline-none"
        >
          <option value="unique">UQ</option>
          <option value="index">IDX</option>
        </select>
        <input
          value={cols}
          onChange={(e) => setCols(e.target.value)}
          placeholder="col1, col2"
          aria-label="Constraint columns"
          className="min-w-0 flex-1 rounded border border-border-subtle bg-canvas px-2 py-1 font-mono text-xs text-ink placeholder:text-ink-faint focus:border-accent-blue focus:outline-none"
        />
        <button
          type="submit"
          className="cursor-pointer rounded bg-accent-blue/20 px-2 py-1 text-xs font-semibold text-accent-blue hover:bg-accent-blue/30"
        >
          Add
        </button>
      </form>
    </div>
  );
}

function RelationshipEditor({ erd, table }: { erd: Erd; table: ErdTable }) {
  const [targetId, setTargetId] = useState("");
  const [cardinality, setCardinality] = useState<Cardinality>("one-to-many");

  const others = erd.tables.filter((t) => t.id !== table.id);
  const related = erd.relationships.filter(
    (r) => r.source_table_id === table.id || r.target_table_id === table.id
  );
  const nameOf = (id: string) =>
    erd.tables.find((t) => t.id === id)?.name ?? "?";

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!targetId) return;
    await erd.addRelationship({
      source_table_id: table.id,
      target_table_id: targetId,
      cardinality,
    });
    setTargetId("");
  }

  return (
    <div className="mt-6 border-t border-border-subtle pt-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
        Relationships
      </h3>

      {related.length > 0 && (
        <ul className="mb-3 space-y-1">
          {related.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-2 rounded-md bg-canvas px-2 py-1.5 text-xs"
            >
              <span className="truncate font-mono text-ink">
                {nameOf(r.source_table_id)} → {nameOf(r.target_table_id)}
              </span>
              <span className="rounded bg-card px-1.5 py-0.5 text-ink-muted">
                {r.cardinality === "one-to-one"
                  ? "1:1"
                  : r.cardinality === "many-to-many"
                    ? "N:N"
                    : "1:N"}
              </span>
              <button
                type="button"
                aria-label="Delete relationship"
                onClick={() => erd.deleteRelationship(r.id)}
                className="ml-auto cursor-pointer rounded p-0.5 text-ink-faint hover:text-red-300"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {others.length > 0 ? (
        <form onSubmit={handleAdd} className="space-y-2">
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            aria-label="Related table"
            className="w-full cursor-pointer rounded-md border border-border-subtle bg-canvas px-2.5 py-1.5 font-mono text-sm text-ink focus:border-accent-blue focus:outline-none"
          >
            <option value="">Relate to…</option>
            {others.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select
              value={cardinality}
              onChange={(e) => setCardinality(e.target.value as Cardinality)}
              aria-label="Cardinality"
              className="flex-1 cursor-pointer rounded-md border border-border-subtle bg-canvas px-2.5 py-1.5 text-sm text-ink-muted focus:border-accent-blue focus:outline-none"
            >
              {CARDINALITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="cursor-pointer rounded-md bg-accent-blue px-3 py-1.5 text-sm font-semibold text-canvas transition-colors hover:bg-[#79b6ff]"
            >
              Link
            </button>
          </div>
        </form>
      ) : (
        <p className="text-xs text-ink-faint">
          Add another table to create a relationship.
        </p>
      )}
    </div>
  );
}

function JsonShapeAiFields({
  erd,
  table,
  col,
}: {
  erd: Erd;
  table: ErdTable;
  col: ErdColumn;
}) {
  const { generateJsonShape } = erd;
  const [busy, setBusy] = useState(false);
  const pending = needsJsonShapeGeneration(col);
  const attempted = useRef(false);

  useEffect(() => {
    attempted.current = false;
  }, [col.id]);

  useEffect(() => {
    if (!pending || attempted.current) return;
    attempted.current = true;
    setBusy(true);
    void generateJsonShape(table.id, col.id).finally(() => setBusy(false));
  }, [pending, table.id, col.id, generateJsonShape]);

  return (
    <div className="mt-2 space-y-2 border-t border-border-subtle pt-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-accent-purple">
          AI JSON shape
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void generateJsonShape(table.id, col.id, { force: true })
              .finally(() => setBusy(false));
          }}
          className="cursor-pointer rounded border border-accent-purple/40 bg-accent-purple/10 px-2 py-0.5 text-[10px] font-semibold text-accent-purple transition-colors hover:bg-accent-purple/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Generating…" : pending ? "Generate" : "Regenerate"}
        </button>
      </div>
      <p className="text-[11px] leading-relaxed text-ink-muted">
        {col.json_description?.trim() ||
          (pending
            ? "Description will be generated automatically by AI."
            : "Generating description with AI…")}
      </p>
      {col.json_schema?.trim() && (
        <pre className="max-h-32 overflow-auto rounded border border-border-subtle bg-surface p-2 font-mono text-[10px] text-ink-muted">
          {col.json_schema}
        </pre>
      )}
    </div>
  );
}

function Toggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`cursor-pointer rounded px-2 py-1 text-[11px] font-bold transition-colors ${
        active
          ? "bg-accent-blue/20 text-accent-blue"
          : "bg-surface text-ink-faint hover:text-ink-muted"
      }`}
    >
      {label}
    </button>
  );
}
