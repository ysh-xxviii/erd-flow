"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ErdRelationship,
  ErdTable,
  PlaybookCheckType,
  PlaybookCriteria,
  PlaybookStep,
  PlaybookStepEval,
  PlaybookStepStatus,
} from "@/lib/types";
import {
  evaluateAllSteps,
  isStepComplete,
  playbookProgress,
  PLAYBOOK_TEMPLATES,
} from "@/lib/playbookCheck";
import {
  createStep,
  createStepsBulk,
  deleteStep,
  listSteps,
  toggleManualDone,
  updateStep,
} from "@/lib/playbook";
import { SlideOver } from "./SlideOver";

const CHECK_TYPES: { value: PlaybookCheckType; label: string }[] = [
  { value: "manual", label: "Manual check-off" },
  { value: "table_exists", label: "Table exists" },
  { value: "column_exists", label: "Column exists" },
  { value: "relationship_exists", label: "Relationship exists" },
];

export function PlaybookPanel({
  diagramId,
  tables,
  relationships,
  canManage,
  onClose,
  onStartGuide,
}: {
  diagramId: string;
  tables: ErdTable[];
  relationships: ErdRelationship[];
  canManage: boolean;
  onClose: () => void;
  onStartGuide: (step: PlaybookStep) => void;
}) {
  const [steps, setSteps] = useState<PlaybookStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listSteps(diagramId);
      setSteps(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load playbook");
    } finally {
      setLoading(false);
    }
  }, [diagramId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const evals = useMemo(
    () => evaluateAllSteps(steps, tables, relationships),
    [steps, tables, relationships]
  );

  const progress = playbookProgress(evals);

  async function handleToggleManual(step: PlaybookStep) {
    setError(null);
    try {
      const updated = await toggleManualDone(step);
      setSteps((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update step");
    }
  }

  function handleGoTo(ev: PlaybookStepEval) {
    onStartGuide(ev.step);
  }

  async function applyTemplate(name: string) {
    const tpl = PLAYBOOK_TEMPLATES.find((t) => t.name === name);
    if (!tpl) return;
    setError(null);
    try {
      const base = steps.length;
      const created = await createStepsBulk(
        diagramId,
        tpl.steps.map((s, i) => ({
          title: s.title,
          instructions: s.instructions,
          check_type: s.check_type,
          criteria: s.criteria,
          ordinal: base + i,
        }))
      );
      setSteps((prev) => [...prev, ...created]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not apply template");
    }
  }

  return (
    <SlideOver onClose={onClose}>
        <header className="border-b border-border-subtle p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1bb38c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              <h2 className="text-base font-semibold text-ink">Playbook</h2>
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

          {steps.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[11px] text-ink-muted">
                <span>Progress</span>
                <span>
                  {progress.done}/{progress.total} complete
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-card">
                <div
                  className="h-full rounded-full bg-accent-green transition-all"
                  style={{
                    width: `${
                      progress.total
                        ? (progress.done / progress.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          )}
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

          {canManage && (
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEditingId("new")}
                className="cursor-pointer rounded-lg bg-accent-green/15 px-3 py-1.5 text-xs font-semibold text-accent-green hover:bg-accent-green/25"
              >
                + Add step
              </button>
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    applyTemplate(e.target.value);
                    e.target.value = "";
                  }
                }}
                className="cursor-pointer rounded-lg border border-border-subtle bg-card px-2 py-1.5 text-xs text-ink"
              >
                <option value="">Apply template…</option>
                {PLAYBOOK_TEMPLATES.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {editingId && canManage && (
            <StepEditor
              diagramId={diagramId}
              step={editingId === "new" ? null : steps.find((s) => s.id === editingId) ?? null}
              nextOrdinal={steps.length}
              tableNames={tables.map((t) => t.name)}
              onSaved={(saved) => {
                setSteps((prev) => {
                  const idx = prev.findIndex((s) => s.id === saved.id);
                  if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = saved;
                    return next;
                  }
                  return [...prev, saved].sort((a, b) => a.ordinal - b.ordinal);
                });
                setEditingId(null);
              }}
              onCancel={() => setEditingId(null)}
            />
          )}

          {loading ? (
            <p className="text-sm text-ink-faint">Loading steps…</p>
          ) : steps.length === 0 ? (
            <p className="text-sm leading-relaxed text-ink-faint">
              {canManage
                ? "No playbook steps yet. Add steps or apply a template so interns know exactly what to do."
                : "Your lead has not assigned tasks yet. Check back later."}
            </p>
          ) : (
            <ul className="space-y-2">
              {evals.map((ev, i) => (
                <StepRow
                  key={ev.step.id}
                  index={i + 1}
                  ev={ev}
                  canManage={canManage}
                  onToggleManual={() => handleToggleManual(ev.step)}
                  onGoTo={() => handleGoTo(ev)}
                  onEdit={() => setEditingId(ev.step.id)}
                  onDelete={async () => {
                    setError(null);
                    try {
                      await deleteStep(ev.step.id);
                      setSteps((prev) => prev.filter((s) => s.id !== ev.step.id));
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Delete failed");
                    }
                  }}
                />
              ))}
            </ul>
          )}
        </div>
    </SlideOver>
  );
}

function StepRow({
  index,
  ev,
  canManage,
  onToggleManual,
  onGoTo,
  onEdit,
  onDelete,
}: {
  index: number;
  ev: PlaybookStepEval;
  canManage: boolean;
  onToggleManual: () => void;
  onGoTo: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const complete = isStepComplete(ev.status);
  const { step, status } = ev;

  return (
    <li
      className={`rounded-xl border p-3 ${
        complete
          ? "border-accent-green/40 bg-accent-green/5"
          : "border-border-subtle bg-card"
      }`}
    >
      <div className="flex items-start gap-2">
        {step.check_type === "manual" ? (
          <input
            type="checkbox"
            checked={step.is_done}
            onChange={onToggleManual}
            className="mt-1 h-4 w-4 cursor-pointer accent-accent-green"
          />
        ) : (
          <span
            className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-[10px] font-bold ${
              complete
                ? "bg-accent-green/20 text-accent-green"
                : "bg-card text-ink-faint"
            }`}
          >
            {index}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`font-medium text-sm ${
                complete ? "text-accent-green" : "text-ink"
              }`}
            >
              {step.title}
            </span>
            <StatusChip status={status} />
          </div>
          {step.instructions && (
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              {step.instructions}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onGoTo}
              className="cursor-pointer rounded-md bg-accent-blue/15 px-2 py-0.5 text-[11px] font-semibold text-accent-blue hover:bg-accent-blue/25"
            >
              Go to
            </button>
            {canManage && (
              <>
                <button
                  type="button"
                  onClick={onEdit}
                  className="cursor-pointer text-[11px] text-ink-muted hover:text-ink"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="cursor-pointer text-[11px] text-ink-faint hover:text-red-300"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function StatusChip({ status }: { status: PlaybookStepStatus }) {
  const map = {
    pending: { label: "Pending", className: "bg-card text-ink-faint" },
    done: { label: "Done", className: "bg-accent-green/15 text-accent-green" },
    auto_verified: {
      label: "Auto-verified",
      className: "bg-accent-green/15 text-accent-green",
    },
  };
  const { label, className } = map[status];
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${className}`}
    >
      {label}
    </span>
  );
}

function StepEditor({
  diagramId,
  step,
  nextOrdinal,
  tableNames,
  onSaved,
  onCancel,
}: {
  diagramId: string;
  step: PlaybookStep | null;
  nextOrdinal: number;
  tableNames: string[];
  onSaved: (step: PlaybookStep) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(step?.title ?? "");
  const [instructions, setInstructions] = useState(step?.instructions ?? "");
  const [checkType, setCheckType] = useState<PlaybookCheckType>(
    step?.check_type ?? "manual"
  );
  const [criteria, setCriteria] = useState<PlaybookCriteria>(
    step?.criteria ?? {}
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        title: title.trim(),
        instructions: instructions.trim(),
        check_type: checkType,
        criteria,
      };
      const saved = step
        ? await updateStep(step.id, payload)
        : await createStep(diagramId, { ...payload, ordinal: nextOrdinal });
      onSaved(saved);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="mb-4 rounded-xl border border-accent-green/30 bg-accent-green/5 p-3"
    >
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-accent-green">
        {step ? "Edit step" : "New step"}
      </p>
      <label className="mb-1 block text-[10px] uppercase text-ink-faint">
        Title
      </label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="mb-2 w-full rounded-md border border-border-subtle bg-canvas px-2 py-1.5 text-sm text-ink focus:border-accent-green focus:outline-none"
      />
      <label className="mb-1 block text-[10px] uppercase text-ink-faint">
        Instructions
      </label>
      <textarea
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        rows={2}
        className="mb-2 w-full resize-none rounded-md border border-border-subtle bg-canvas px-2 py-1.5 text-xs text-ink focus:border-accent-green focus:outline-none"
      />
      <label className="mb-1 block text-[10px] uppercase text-ink-faint">
        Verification
      </label>
      <select
        value={checkType}
        onChange={(e) => setCheckType(e.target.value as PlaybookCheckType)}
        className="mb-2 w-full cursor-pointer rounded-md border border-border-subtle bg-canvas px-2 py-1.5 text-xs text-ink"
      >
        {CHECK_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      <CriteriaFields
        checkType={checkType}
        criteria={criteria}
        tableNames={tableNames}
        onChange={setCriteria}
      />

      {err && <p className="mb-2 text-xs text-red-300">{err}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="cursor-pointer rounded-lg bg-accent-green px-3 py-1.5 text-xs font-semibold text-canvas hover:bg-[#22c99a] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save step"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-lg border border-border-subtle px-3 py-1.5 text-xs text-ink-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function CriteriaFields({
  checkType,
  criteria,
  tableNames,
  onChange,
}: {
  checkType: PlaybookCheckType;
  criteria: PlaybookCriteria;
  tableNames: string[];
  onChange: (c: PlaybookCriteria) => void;
}) {
  if (checkType === "manual") return null;

  const tableInput = (
    key: keyof PlaybookCriteria,
    label: string,
    listId?: string
  ) => (
    <div className="mb-2">
      <label className="mb-1 block text-[10px] uppercase text-ink-faint">
        {label}
      </label>
      <input
        list={listId}
        value={criteria[key] ?? ""}
        onChange={(e) => onChange({ ...criteria, [key]: e.target.value })}
        placeholder="table_name"
        className="w-full rounded-md border border-border-subtle bg-canvas px-2 py-1 font-mono text-xs text-ink focus:border-accent-green focus:outline-none"
      />
      {listId && (
        <datalist id={listId}>
          {tableNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      )}
    </div>
  );

  if (checkType === "table_exists") {
    return tableInput("table", "Table name", "playbook-tables");
  }
  if (checkType === "column_exists") {
    return (
      <>
        {tableInput("table", "Table name", "playbook-tables-col")}
        <div className="mb-2">
          <label className="mb-1 block text-[10px] uppercase text-ink-faint">
            Column name
          </label>
          <input
            value={criteria.column ?? ""}
            onChange={(e) =>
              onChange({ ...criteria, column: e.target.value })
            }
            placeholder="column_name"
            className="w-full rounded-md border border-border-subtle bg-canvas px-2 py-1 font-mono text-xs text-ink focus:border-accent-green focus:outline-none"
          />
        </div>
      </>
    );
  }
  if (checkType === "relationship_exists") {
    return (
      <>
        {tableInput("from_table", "From table", "playbook-from")}
        {tableInput("to_table", "To table", "playbook-to")}
      </>
    );
  }
  return null;
}
