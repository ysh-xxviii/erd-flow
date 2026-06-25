"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useReactFlow, useViewport } from "@xyflow/react";
import type { ErdTable } from "@/lib/types";
import type { GuidePhase, PlaybookGuide } from "@/lib/playbookGuide";
import { NODE_W, nodeHeight } from "./EntityNode";

function tableCenter(t: ErdTable): { x: number; y: number } {
  return {
    x: t.pos_x + NODE_W / 2,
    y: t.pos_y + nodeHeight(t) / 2,
  };
}

export function PlaybookGuideOverlay({
  guide,
  tables,
  phaseIndex,
  onPhaseChange,
  onDismiss,
  onPulseAddTable,
}: {
  guide: PlaybookGuide;
  tables: ErdTable[];
  phaseIndex: number;
  onPhaseChange: (index: number) => void;
  onDismiss: () => void;
  onPulseAddTable: (active: boolean) => void;
}) {
  const { flowToScreenPosition } = useReactFlow();
  const phase = guide.phases[phaseIndex];
  const total = guide.phases.length;

  useEffect(() => {
    onPulseAddTable(!!phase?.pulseAddTable);
    return () => onPulseAddTable(false);
  }, [phase?.pulseAddTable, onPulseAddTable]);

  useEffect(() => {
    if (!phase) return;
    const timer = setTimeout(() => {
      if (phaseIndex + 1 < total) {
        onPhaseChange(phaseIndex + 1);
      } else {
        onDismiss();
      }
    }, phase.durationMs);
    return () => clearTimeout(timer);
  }, [phase, phaseIndex, total, onPhaseChange, onDismiss]);

  const toScreen = useCallback(
    (flowX: number, flowY: number) =>
      flowToScreenPosition({ x: flowX, y: flowY }),
    [flowToScreenPosition]
  );

  const linePath = useMemo(() => {
    if (!phase?.line) return null;
    const from = tables.find((t) => t.id === phase.line!.fromTableId);
    const to = tables.find((t) => t.id === phase.line!.toTableId);
    if (!from || !to) return null;
    const a = tableCenter(from);
    const b = tableCenter(to);
    const sa = toScreen(a.x, a.y);
    const sb = toScreen(b.x, b.y);
    return { x1: sa.x, y1: sa.y, x2: sb.x, y2: sb.y };
  }, [phase, tables, toScreen]);

  if (!phase) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
      {/* Light scrim so guide mode is obvious without blocking the canvas */}
      <div className="absolute inset-0 bg-black/15" aria-hidden="true" />

      {linePath && (
        <svg className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <marker
              id="playbook-guide-arrow"
              markerWidth="10"
              markerHeight="10"
              refX="8"
              refY="5"
              orient="auto"
            >
              <path d="M0,0 L10,5 L0,10 Z" fill="#1bb38c" />
            </marker>
          </defs>
          <line
            x1={linePath.x1}
            y1={linePath.y1}
            x2={linePath.x2}
            y2={linePath.y2}
            className="playbook-guide-line"
            markerEnd="url(#playbook-guide-arrow)"
          />
        </svg>
      )}

      {/* Primary instruction — always visible at top center */}
      <div className="pointer-events-none absolute left-1/2 top-16 z-10 w-[min(420px,calc(100%-2rem))] -translate-x-1/2 rounded-xl border border-accent-green/50 bg-[rgba(12,17,28,0.97)] px-4 py-3 shadow-2xl backdrop-blur">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-accent-green">
          Step {phaseIndex + 1} of {total}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink">{phase.message}</p>
      </div>

      {phase.pulseAddTable && (
        <div className="pointer-events-none absolute bottom-28 left-[260px] z-10 max-w-[260px] rounded-lg border border-accent-green/50 bg-[rgba(12,17,28,0.97)] px-3 py-2.5 shadow-xl">
          <p className="text-[11px] font-semibold text-accent-green">
            Use the sidebar form below
          </p>
        </div>
      )}

      <div className="pointer-events-auto absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full border border-[#2a3550] bg-[rgba(12,17,28,0.95)] px-4 py-2 shadow-lg backdrop-blur">
        <span className="text-[11px] text-ink-muted">
          {phaseIndex + 1} / {total}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="cursor-pointer rounded-md bg-accent-green/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent-green hover:bg-accent-green/25"
        >
          Dismiss guide
        </button>
      </div>
    </div>
  );
}

/** Hook-friendly helper: compute node class names during an active guide. */
export function guideNodeClassName(
  nodeId: string,
  phase: GuidePhase | undefined,
  hoveredId: string | null,
  relatedIds: Set<string>
): { className: string; zIndex: number } {
  if (phase) {
    const inPhase = phase.tableIds.includes(nodeId);
    const active = phase.activeTableIds.includes(nodeId);
    if (active) {
      return { className: "erd-node-playbook-guide-active", zIndex: 12 };
    }
    if (inPhase) {
      return { className: "erd-node-playbook-guide-target", zIndex: 8 };
    }
    if (phase.tableIds.length > 0) {
      return { className: "erd-node-dim", zIndex: 1 };
    }
  }

  if (!hoveredId) return { className: "", zIndex: 2 };
  if (nodeId === hoveredId) return { className: "erd-node-active", zIndex: 10 };
  if (relatedIds.has(nodeId)) return { className: "erd-node-related", zIndex: 4 };
  return { className: "erd-node-dim", zIndex: 1 };
}

export function useFitGuideTables(
  guide: PlaybookGuide | null,
  tables: ErdTable[]
) {
  const { fitView, setCenter } = useReactFlow();
  const { zoom } = useViewport();

  return useCallback(() => {
    if (!guide || guide.fitTableIds.length === 0) return;
    const targets = guide.fitTableIds
      .map((id) => tables.find((t) => t.id === id))
      .filter(Boolean) as ErdTable[];

    if (targets.length === 0) return;

    if (targets.length === 1) {
      const t = targets[0];
      const h = nodeHeight(t);
      setCenter(t.pos_x + NODE_W / 2, t.pos_y + h / 2, {
        zoom: Math.max(zoom, 0.75),
        duration: 400,
      });
      return;
    }

    fitView({
      nodes: targets.map((t) => ({ id: t.id })),
      padding: 0.35,
      duration: 450,
    });
  }, [guide, tables, fitView, setCenter, zoom]);
}
