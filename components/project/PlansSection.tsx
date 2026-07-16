"use client";

import { useCallback, useEffect, useState } from "react";
import type { DiagramPlan, DiagramPlanItem, ErdTable } from "@/lib/types";
import {
  addPlanComment,
  getPlan,
  listPlanComments,
  listPlans,
  updatePlanStatus,
} from "@/lib/plans";
import { useProjectStore } from "@/lib/projectStore";
import { usePendingChanges } from "@/lib/pendingChanges";
import { Inspector } from "./Inspector";

const STATUS_COLOR: Record<string, string> = {
  draft: "#D9A03F",
  in_review: "#6E9BF5",
  approved: "#3FB27F",
  changes_requested: "#C25E5E",
};

export function PlansSection({
  diagramId,
  tables,
}: {
  diagramId: string;
  tables: ErdTable[];
}) {
  const {
    selectedPlanId,
    setSelectedPlanId,
    planReviewMode,
    setPlanReviewMode,
    requestProdGate,
  } = useProjectStore();
  const { pushToast } = usePendingChanges();
  const [plans, setPlans] = useState<DiagramPlan[]>([]);
  const [plan, setPlan] = useState<DiagramPlan | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [comments, setComments] = useState<
    { id: string; body: string; created_at: string }[]
  >([]);
  const [reply, setReply] = useState("");

  const reload = useCallback(async () => {
    try {
      setPlans(await listPlans(diagramId));
    } catch {
      setPlans([]);
    }
  }, [diagramId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!selectedPlanId || !planReviewMode) {
      setPlan(null);
      return;
    }
    void getPlan(selectedPlanId).then(setPlan).catch(() => setPlan(null));
    void listPlanComments(selectedPlanId)
      .then(setComments)
      .catch(() => setComments([]));
    setStepIdx(0);
  }, [selectedPlanId, planReviewMode]);

  useEffect(() => {
    if (!planReviewMode || !plan) return;
    function onKey(e: KeyboardEvent) {
      const items = plan?.items ?? [];
      if (e.key === "n" || e.key === "ArrowRight") {
        setStepIdx((i) => Math.min(items.length - 1, i + 1));
      }
      if (e.key === "p" || e.key === "ArrowLeft") {
        setStepIdx((i) => Math.max(0, i - 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [planReviewMode, plan]);

  if (planReviewMode && plan) {
    const items = plan.items ?? [];
    const current = items[stepIdx];
    return (
      <div className="flex h-full min-w-0 flex-1">
        <div className="relative flex min-w-0 flex-1 flex-col bg-[#111318]">
          <div className="flex items-center justify-between border-b border-[#2E333D] px-4 py-2">
            <div>
              <p className="text-[10px] uppercase text-[#646D7E]">Plan review</p>
              <h2 className="text-sm font-semibold text-[#E7EAF0]">{plan.title}</h2>
            </div>
            <button
              type="button"
              onClick={() => setPlanReviewMode(false)}
              className="cursor-pointer text-xs text-[#9AA3B2]"
            >
              ← Back to list
            </button>
          </div>
          <div className="flex gap-3 border-b border-[#2E333D] px-4 py-2 text-[10px]">
            <span className="text-[#3FB27F]">■ added</span>
            <span className="text-[#D9A03F]">■ modified</span>
            <span className="text-[#C25E5E]">■ removed</span>
          </div>
          <div className="relative min-h-0 flex-1 overflow-auto p-6">
            <p className="mb-4 text-xs text-[#9AA3B2]">
              ERD diff overlays (MVP): highlighted tables from schema items.
            </p>
            <div className="flex flex-wrap gap-3">
              {tables.slice(0, 12).map((t) => {
                const related = items.some(
                  (it) =>
                    it.kind === "schema" &&
                    (String(it.payload.tableId) === t.id ||
                      String(it.payload.tableName) === t.name ||
                      it.summary.toLowerCase().includes(t.name.toLowerCase()))
                );
                const hint = current?.diff_hint ?? "modified";
                const color =
                  hint === "added"
                    ? "#3FB27F"
                    : hint === "removed"
                      ? "#C25E5E"
                      : "#D9A03F";
                return (
                  <div
                    key={t.id}
                    className="rounded-md border px-3 py-2 font-mono text-xs"
                    style={{
                      borderColor: related ? color : "#2E333D",
                      background: related ? `${color}18` : "#15181E",
                      color: related ? color : "#9AA3B2",
                      outline:
                        related && current
                          ? `2px solid ${color}`
                          : undefined,
                    }}
                  >
                    {t.name}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-[#2E333D] px-4 py-2">
            <div className="text-xs text-[#9AA3B2]">
              Step {items.length ? stepIdx + 1 : 0}/{items.length} · n/p or ←/→
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  void updatePlanStatus(plan.id, "changes_requested").then(
                    () => {
                      pushToast("Changes requested", plan.title);
                      setPlanReviewMode(false);
                      void reload();
                    }
                  )
                }
                className="cursor-pointer rounded border border-[#2E333D] px-3 py-1.5 text-xs text-[#9AA3B2]"
              >
                Request changes
              </button>
              <button
                type="button"
                onClick={() =>
                  requestProdGate(() => {
                    void updatePlanStatus(plan.id, "approved").then(() => {
                      pushToast(
                        "Approved & shipped",
                        "MVP: toast only — no live DB apply."
                      );
                      setPlanReviewMode(false);
                      void reload();
                    });
                  })
                }
                className="cursor-pointer rounded bg-[#3FB27F] px-3 py-1.5 text-xs font-semibold text-[#111318]"
              >
                Approve & ship
              </button>
            </div>
          </div>
        </div>

        <Inspector title="Walkthrough" breadcrumb={plan.title}>
          <div className="space-y-3">
            {current ? (
              <div className="rounded border border-[#2E333D] bg-[#1A1D23] p-2 text-xs">
                <p className="text-[10px] uppercase text-[#646D7E]">
                  {current.kind}
                </p>
                <p className="mt-1 text-[#E7EAF0]">{current.summary}</p>
                {current.diff_hint && (
                  <p className="mt-1 text-[#D9A03F]">{current.diff_hint}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-[#646D7E]">No items in this plan.</p>
            )}
            <ol className="space-y-1">
              {items.map((it, i) => (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => setStepIdx(i)}
                    className={`w-full cursor-pointer rounded px-2 py-1 text-left text-[11px] ${
                      i === stepIdx
                        ? "bg-[#6E9BF5]/15 text-[#6E9BF5]"
                        : "text-[#9AA3B2]"
                    }`}
                  >
                    {i + 1}. {it.summary}
                  </button>
                </li>
              ))}
            </ol>
            <div className="border-t border-[#2E333D] pt-3">
              <p className="mb-2 text-[10px] uppercase text-[#646D7E]">Thread</p>
              <ul className="mb-2 max-h-32 space-y-1 overflow-y-auto">
                {comments.map((c) => (
                  <li
                    key={c.id}
                    className="rounded bg-[#1A1D23] px-2 py-1 text-[11px] text-[#9AA3B2]"
                  >
                    {c.body}
                  </li>
                ))}
              </ul>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={2}
                className="w-full rounded border border-[#2E333D] bg-[#111318] p-2 text-[11px] text-[#E7EAF0]"
                placeholder="Reply…"
              />
              <button
                type="button"
                onClick={() => {
                  if (!reply.trim() || !selectedPlanId) return;
                  void addPlanComment(selectedPlanId, reply.trim()).then(() => {
                    setReply("");
                    return listPlanComments(selectedPlanId).then(setComments);
                  });
                }}
                className="mt-1 cursor-pointer text-[11px] text-[#6E9BF5]"
              >
                Post
              </button>
            </div>
          </div>
        </Inspector>
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-1">
      <aside className="flex w-[248px] flex-none flex-col border-r border-[#2E333D] bg-[#15181E]">
        <div className="border-b border-[#2E333D] px-3 py-2.5 text-[10px] uppercase text-[#646D7E]">
          Plans
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {plans.length === 0 && (
            <p className="px-3 py-2 text-xs text-[#646D7E]">
              No plans yet. Queue edits and Save to plan.
            </p>
          )}
          {plans.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setSelectedPlanId(p.id);
                setPlanReviewMode(true);
              }}
              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-[#1A1D23]"
            >
              <span className="truncate text-xs text-[#E7EAF0]">{p.title}</span>
              <span
                className="text-[10px]"
                style={{ color: STATUS_COLOR[p.status] }}
              >
                {p.status}
              </span>
            </button>
          ))}
        </div>
      </aside>
      <div className="flex flex-1 items-center justify-center bg-[#111318] text-sm text-[#646D7E]">
        Select a plan to review
      </div>
      <Inspector title="Plans" breadcrumb="Control plane">
        <p className="text-xs text-[#9AA3B2]">
          Plans bundle unsaved changes into a reviewable change set. Approve &
          ship is prod-gated and does not apply to a live customer DB in MVP.
        </p>
      </Inspector>
    </div>
  );
}

export type { DiagramPlanItem };
