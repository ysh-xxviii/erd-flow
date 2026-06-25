"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MarkerType,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStoreApi,
  useViewport,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { buildPlaybookGuide, type PlaybookGuide } from "@/lib/playbookGuide";
import {
  SCHEMA_COLORS,
  tableColorHex,
  type Diagram,
  type ErdRelationship,
  type ErdTable,
  type PlaybookStep,
  type WorkspaceRole,
} from "@/lib/types";
import { useErd } from "./useErd";
import { computeHoverFocus, resolveEdgeHandles } from "@/lib/erdLayout";
import { findJsonShape } from "@/lib/jsonShapes";
import { EntityNode, NODE_W, nodeHeight } from "./EntityNode";
import { SidePanel } from "./SidePanel";
import { TableEditorDrawer } from "./TableEditorDrawer";
import { JsonSchemaDrawer } from "./JsonSchemaDrawer";
import { AiSuggestPanel } from "./AiSuggestPanel";
import { MigrationsPanel } from "./MigrationsPanel";
import { PlaybookPanel } from "./PlaybookPanel";
import {
  PlaybookGuideOverlay,
  guideNodeClassName,
  useFitGuideTables,
} from "./PlaybookGuideOverlay";
import { PresenceCursors, PresenceAvatars } from "./PresenceLayer";
import { CommentsPanel } from "./CommentsPanel";
import { useRealtimeErd } from "@/lib/useRealtimeErd";
import { usePresence } from "@/lib/usePresence";
import { listComments } from "@/lib/comments";
import { createClient } from "@/lib/supabase/client";

const nodeTypes: NodeTypes = { entity: EntityNode };

function parseColHandle(handle: string | null | undefined): string | null {
  if (!handle) return null;
  if (handle === "s-table" || handle === "t-table") return null;
  return handle.slice(2); // strip "s-" / "t-"
}

function FitViewOnLoad({
  diagramId,
  tableCount,
  disabled,
}: {
  diagramId: string;
  tableCount: number;
  disabled: boolean;
}) {
  const { fitView } = useReactFlow();
  const store = useStoreApi();

  useEffect(() => {
    if (disabled || tableCount === 0) return;
    const t = setTimeout(() => fitView({ padding: 0.2, duration: 250 }), 50);
    return () => clearTimeout(t);
  }, [diagramId, tableCount, disabled, fitView]);

  useEffect(() => {
    if (disabled || tableCount === 0) return;
    const domNode = store.getState().domNode;
    if (!domNode) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void fitView({ padding: 0.2, duration: 250 });
      }, 150);
    });
    ro.observe(domNode);
    return () => {
      ro.disconnect();
      clearTimeout(timer);
    };
  }, [diagramId, tableCount, disabled, fitView, store]);

  return null;
}

function ErdBuilderInner({
  diagram,
  initialTables,
  initialRelationships,
  userRole,
  currentUser,
}: {
  diagram: Diagram;
  initialTables: ErdTable[];
  initialRelationships: ErdRelationship[];
  userRole: WorkspaceRole;
  currentUser: { id: string; name: string };
}) {
  const isOwner = userRole === "owner";
  const erd = useErd(diagram.id, initialTables, initialRelationships);
  const { tables, relationships, saving, moveTable, addRelationship, deleteRelationship, relayoutAllTables, deleteTable } =
    erd;

  useRealtimeErd(diagram.id, { reload: erd.reload, setTables: erd.setTables });
  const { peers, cursors, sendCursor } = usePresence(diagram.id, currentUser);

  const { zoomIn, zoomOut, fitView, setCenter, screenToFlowPosition } =
    useReactFlow();
  const { zoom } = useViewport();

  const [selectedTableId, setSelectedTableId] = useState<string | null>(
    initialTables[0]?.id ?? null
  );
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [jsonColumnId, setJsonColumnId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [migrationsOpen, setMigrationsOpen] = useState(false);
  const [playbookOpen, setPlaybookOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentFocusTableId, setCommentFocusTableId] = useState<string | null>(
    null
  );
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>(
    {}
  );
  const [generalCommentCount, setGeneralCommentCount] = useState(0);
  const [activeGuide, setActiveGuide] = useState<PlaybookGuide | null>(null);
  const [guidePhaseIndex, setGuidePhaseIndex] = useState(0);
  const [pulseAddTable, setPulseAddTable] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showFirstVisitHint, setShowFirstVisitHint] = useState(false);
  const [applyNotice, setApplyNotice] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Keep latest table geometry for cursor hit-testing without re-creating the
  // pointer handler on every change.
  const tablesRef = useRef(tables);
  tablesRef.current = tables;

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      // Derive the hovered table from the same flow point we broadcast so the
      // remote outline can never drift onto a neighboring table.
      let overId: string | null = null;
      for (const t of tablesRef.current) {
        const h = nodeHeight(t);
        if (
          flow.x >= t.pos_x &&
          flow.x <= t.pos_x + NODE_W &&
          flow.y >= t.pos_y &&
          flow.y <= t.pos_y + h
        ) {
          overId = t.id;
        }
      }
      sendCursor(flow.x, flow.y, overId);
    },
    [screenToFlowPosition, sendCursor]
  );

  const remoteHoverIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of Object.values(cursors)) {
      if (c.tableId) ids.add(c.tableId);
    }
    return ids;
  }, [cursors]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = "erd-flow-hint-seen";
    if (!localStorage.getItem(key) && initialTables.length === 0) {
      setShowFirstVisitHint(true);
    }
  }, [initialTables.length]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const rows = await listComments(diagram.id);
        if (!active) return;
        const counts: Record<string, number> = {};
        let general = 0;
        for (const c of rows) {
          if (c.resolved) continue;
          if (c.table_id) {
            counts[c.table_id] = (counts[c.table_id] ?? 0) + 1;
          } else {
            general += 1;
          }
        }
        setCommentCounts(counts);
        setGeneralCommentCount(general);
      } catch {
        /* non-fatal */
      }
    };
    void refresh();

    const supabase = createClient();
    const channel = supabase
      .channel(`comment-counts:${diagram.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "diagram_comments",
          filter: `diagram_id=eq.${diagram.id}`,
        },
        () => void refresh()
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [diagram.id]);

  const openComments = useCallback((tableId: string | null) => {
    setCommentFocusTableId(tableId);
    setCommentsOpen(true);
  }, []);

  const totalOpenComments = useMemo(
    () =>
      Object.values(commentCounts).reduce((a, b) => a + b, 0) +
      generalCommentCount,
    [commentCounts, generalCommentCount]
  );

  const fitGuideTables = useFitGuideTables(activeGuide, tables);
  const currentGuidePhase = activeGuide?.phases[guidePhaseIndex];

  const dismissGuide = useCallback(() => {
    setActiveGuide(null);
    setGuidePhaseIndex(0);
    setPulseAddTable(false);
  }, []);

  const startGuide = useCallback(
    (step: PlaybookStep) => {
      const guide = buildPlaybookGuide(step, tables, relationships);
      if (!guide) return;
      setPlaybookOpen(false);
      setActiveGuide(guide);
      setGuidePhaseIndex(0);
      setTimeout(() => fitGuideTables(), 120);
    },
    [tables, relationships, fitGuideTables]
  );

  const openJsonSchema = useCallback((columnId: string) => {
    setEditingTableId(null);
    setJsonColumnId(columnId);
  }, []);

  const jsonShape = useMemo(
    () => (jsonColumnId ? findJsonShape(tables, jsonColumnId) : null),
    [jsonColumnId, tables]
  );

  const { relatedIds } = useMemo(
    () => computeHoverFocus(hoveredId, relationships),
    [hoveredId, relationships]
  );

  const focusTable = useCallback(
    (id: string) => {
      setSelectedTableId(id);
      const t = tables.find((x) => x.id === id);
      if (!t) return;
      const h = nodeHeight(t);
      setCenter(t.pos_x + NODE_W / 2, t.pos_y + h / 2, {
        zoom: Math.max(zoom, 0.9),
        duration: 300,
      });
    },
    [tables, setCenter, zoom]
  );

  // Map of column id -> "table.column" label for FK columns (source side).
  const fkRefs = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of relationships) {
      if (!r.source_col_id) continue;
      const target = tables.find((t) => t.id === r.target_table_id);
      if (!target) continue;
      const targetCol =
        target.columns.find((c) => c.id === r.target_col_id) ??
        target.columns.find((c) => c.is_pk) ??
        target.columns[0];
      map[r.source_col_id] = `${target.name}.${targetCol ? targetCol.name : "id"}`;
    }
    return map;
  }, [relationships, tables]);

  const buildNodes = useCallback(
    (list: ErdTable[]): Node[] =>
      list.map((t) => ({
        id: t.id,
        type: "entity",
        position: { x: t.pos_x, y: t.pos_y },
        data: {
          name: t.name,
          color: t.color,
          category: t.category,
          description: t.description,
          constraints: t.constraints,
          columns: t.columns,
          fkRefs,
          onJsonClick: openJsonSchema,
          commentCount: commentCounts[t.id] ?? 0,
          onCommentClick: () => openComments(t.id),
        },
      })),
    [fkRefs, openJsonSchema, commentCounts, openComments]
  );

  const buildEdges = useCallback(
    (rels: ErdRelationship[], list: ErdTable[]): Edge[] =>
      rels.map((r) => {
        const src = list.find((t) => t.id === r.source_table_id);
        const tgt = list.find((t) => t.id === r.target_table_id);
        const color = src
          ? tableColorHex({ color: src.color, category: src.category })
          : SCHEMA_COLORS.edge;
        const sourceCol = src?.columns.find((c) => c.id === r.source_col_id);
        const isFramework =
          src?.category === "framework" || tgt?.category === "framework";
        const isNullableFk =
          !!sourceCol?.is_fk && (sourceCol.is_nullable ?? false);
        const isDotted = isFramework || isNullableFk;
        const { sourceHandle, targetHandle } = resolveEdgeHandles(r, list);
        return {
          id: r.id,
          source: r.source_table_id,
          target: r.target_table_id,
          sourceHandle,
          targetHandle,
          type: "smoothstep",
          className: isDotted ? "erd-edge-dotted" : undefined,
          style: { stroke: color, strokeWidth: 1.8, opacity: 0.85 },
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
        };
      }),
    []
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(
    buildNodes(initialTables)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    buildEdges(initialRelationships, initialTables)
  );

  useEffect(() => {
    setNodes(buildNodes(tables));
  }, [tables, buildNodes, setNodes]);

  useEffect(() => {
    setEdges(buildEdges(relationships, tables));
  }, [relationships, tables, buildEdges, setEdges]);

  const displayNodes = useMemo(
    () =>
      nodes.map((n) => {
        if (activeGuide) {
          const { className, zIndex } = guideNodeClassName(
            n.id,
            currentGuidePhase,
            hoveredId,
            relatedIds
          );
          return { ...n, className, zIndex };
        }

        let className = "";
        let zIndex = 2;

        if (hoveredId) {
          const isActive = n.id === hoveredId;
          const isRelated = relatedIds.has(n.id);
          className = "erd-node-dim";
          if (isActive) {
            className = "erd-node-active";
            zIndex = 10;
          } else if (isRelated) {
            className = "erd-node-related";
            zIndex = 4;
          } else {
            zIndex = 1;
          }
        }

        if (remoteHoverIds.has(n.id) && n.id !== hoveredId) {
          className = className
            ? `${className} erd-node-remote-hover`
            : "erd-node-remote-hover";
          if (zIndex < 6) zIndex = 6;
        }

        return { ...n, className, zIndex };
      }),
    [nodes, hoveredId, relatedIds, activeGuide, currentGuidePhase, remoteHoverIds]
  );

  const displayEdges = useMemo(
    () =>
      edges.map((e) => {
        if (!hoveredId) return e;
        const touches =
          e.source === hoveredId || e.target === hoveredId;
        return {
          ...e,
          className: touches
            ? `${e.className ?? ""} erd-edge-focus`.trim()
            : `${e.className ?? ""} erd-edge-dim`.trim(),
        };
      }),
    [edges, hoveredId]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      addRelationship({
        source_table_id: connection.source,
        target_table_id: connection.target,
        source_col_id: parseColHandle(connection.sourceHandle),
        target_col_id: parseColHandle(connection.targetHandle),
      });
    },
    [addRelationship]
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      deleted.forEach((e) => deleteRelationship(e.id));
    },
    [deleteRelationship]
  );

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      moveTable(node.id, node.position.x, node.position.y);
    },
    [moveTable]
  );

  const editingTable = editingTableId;
  const openTableEditor = useCallback(
    (id: string) => {
      if (saving) return;
      setApplyNotice(null);
      setJsonColumnId(null);
      setSelectedTableId(id);
      setEditingTableId(id);
      focusTable(id);
    },
    [focusTable, saving]
  );

  const deleteTarget = deleteConfirmId
    ? tables.find((t) => t.id === deleteConfirmId)
    : null;

  async function confirmDeleteTable() {
    if (!deleteConfirmId) return;
    await deleteTable(deleteConfirmId);
    if (selectedTableId === deleteConfirmId) setSelectedTableId(null);
    if (editingTableId === deleteConfirmId) setEditingTableId(null);
    setDeleteConfirmId(null);
  }

  function dismissFirstVisitHint(openPlaybook?: boolean) {
    localStorage.setItem("erd-flow-hint-seen", "1");
    setShowFirstVisitHint(false);
    if (openPlaybook) setPlaybookOpen(true);
  }

  return (
    <div
      className="flex h-[calc(100vh-3.5rem)] w-full"
      onMouseLeave={() => setHoveredId(null)}
    >
      <SidePanel
        erd={erd}
        diagramName={diagram.name}
        hoveredId={hoveredId}
        relatedIds={relatedIds}
        editingTableId={editingTableId}
        onHoverTable={setHoveredId}
        onFocusTable={focusTable}
        onOpenJsonShape={openJsonSchema}
        selectedJsonColumnId={jsonColumnId}
        onEditTable={openTableEditor}
        onDeleteTable={(id) => setDeleteConfirmId(id)}
        onOpenAi={() => setAiOpen(true)}
        onOpenPlaybook={() => setPlaybookOpen(true)}
        pulseAddTable={pulseAddTable}
      />

      <div className="relative min-w-0 flex-1 overflow-hidden">
        {/* top-left: back + saving */}
        <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-2">
          <Link
            href="/dashboard"
            className="pointer-events-auto cursor-pointer rounded-lg border border-[#2a3550] bg-[#141c2e] px-3 py-1.5 text-sm text-[#cdd7ec] transition-colors hover:text-ink"
          >
            ← Dashboard
          </Link>
          {saving && (
            <span className="pointer-events-auto rounded-lg border border-[#2a3550] bg-[#141c2e] px-3 py-1.5 text-xs text-[#9aa6c2]">
              Saving…
            </span>
          )}
          <div className="pointer-events-auto ml-1">
            <PresenceAvatars peers={peers} selfId={currentUser.id} />
          </div>
        </div>

        {/* top-right: zoom toolbar */}
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
          <div className="flex h-8 items-center overflow-hidden rounded-lg border border-[#2a3550] bg-[#141c2e]">
            <button
              type="button"
              onClick={() => zoomOut()}
              aria-label="Zoom out"
              className="h-full w-8 cursor-pointer text-base text-[#cdd7ec] hover:bg-[#1b2540]"
            >
              −
            </button>
            <div className="w-12 border-x border-[#2a3550] text-center text-[11px] leading-8 text-[#9aa6c2]">
              {Math.round(zoom * 100)}%
            </div>
            <button
              type="button"
              onClick={() => zoomIn()}
              aria-label="Zoom in"
              className="h-full w-8 cursor-pointer text-base text-[#cdd7ec] hover:bg-[#1b2540]"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={async () => {
              await relayoutAllTables();
              setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 80);
            }}
            disabled={tables.length === 0 || saving}
            className="h-8 cursor-pointer rounded-lg border border-[#2a3550] bg-[#141c2e] px-3 text-xs text-[#cdd7ec] transition-colors hover:bg-[#1b2540] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Layout
          </button>
          <button
            type="button"
            onClick={() => fitView({ padding: 0.2, duration: 250 })}
            className="h-8 cursor-pointer rounded-lg border border-[#2a3550] bg-[#141c2e] px-3 text-xs text-[#cdd7ec] transition-colors hover:bg-[#1b2540]"
          >
            Fit
          </button>
          <button
            type="button"
            onClick={() => openComments(selectedTableId)}
            className="relative h-8 cursor-pointer rounded-lg border border-[#2a3550] bg-[#141c2e] px-3 text-xs text-[#cdd7ec] transition-colors hover:bg-[#1b2540]"
          >
            Comments
            {totalOpenComments > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e3b341] px-1 text-[9px] font-bold text-[#0c111c]">
                {totalOpenComments}
              </span>
            )}
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={() => setMigrationsOpen(true)}
              className="h-8 cursor-pointer rounded-lg border border-[#2a3550] bg-[#141c2e] px-3 text-xs text-[#cdd7ec] transition-colors hover:bg-[#1b2540]"
            >
              Migrations
            </button>
          )}
          {selectedTableId && (
            <>
              <button
                type="button"
                onClick={() => openTableEditor(selectedTableId)}
                className="h-8 cursor-pointer rounded-lg border border-accent-blue/50 bg-accent-blue/15 px-3 text-xs font-semibold text-accent-blue transition-colors hover:bg-accent-blue/25"
              >
                Edit table
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(selectedTableId)}
                className="h-8 cursor-pointer rounded-lg border border-red-500/40 bg-red-500/10 px-3 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20"
              >
                Delete table
              </button>
            </>
          )}
        </div>

        <ReactFlow
          className="h-full w-full"
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onNodeDragStop={onNodeDragStop}
          onNodeMouseEnter={(_, node) => setHoveredId(node.id)}
          onNodeClick={(_, node) => {
            setSelectedTableId(node.id);
            focusTable(node.id);
          }}
          onNodeDoubleClick={(_, node) => openTableEditor(node.id)}
          onPointerMove={onPointerMove}
          nodeTypes={nodeTypes}
          minZoom={0.2}
          maxZoom={2.2}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ type: "default" }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={26}
            size={1}
            color="rgba(255,255,255,0.06)"
          />
          <FitViewOnLoad
            diagramId={diagram.id}
            tableCount={tables.length}
            disabled={!!activeGuide}
          />
        </ReactFlow>

        <PresenceCursors cursors={cursors} />

        {/* legend */}
        <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-lg border border-[#1d2740] bg-[rgba(12,17,28,0.92)] px-3 py-2.5 text-[10.5px] text-[#9aa6c2] backdrop-blur">
          <div className="mb-2 text-[9px] uppercase tracking-wider text-[#5e6a85]">
            Legend
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span style={{ color: SCHEMA_COLORS.pk }}>◆</span> primary key
            </div>
            <div className="flex items-center gap-2">
              <span style={{ color: SCHEMA_COLORS.fk }}>◇</span> foreign key ·{" "}
              <span className="text-[#7e8aa6]">name?</span> = nullable
            </div>
            <div className="flex items-center gap-2">
              <svg width="26" height="8" aria-hidden="true">
                <line x1="0" y1="4" x2="26" y2="4" stroke={SCHEMA_COLORS.edge} strokeWidth="2" />
              </svg>
              relationship
            </div>
            <div className="flex items-center gap-2">
              <svg width="26" height="8" aria-hidden="true">
                <line
                  x1="0"
                  y1="4"
                  x2="26"
                  y2="4"
                  stroke={SCHEMA_COLORS.edge}
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />
              </svg>
              infra link
            </div>
          </div>
        </div>

        {/* hint */}
        <div className="pointer-events-none absolute bottom-4 right-4 z-10 text-[10px] text-[#46506a]">
          click to select · double-click to edit · scroll to zoom · hover to focus
        </div>

        {activeGuide && (
          <PlaybookGuideOverlay
            guide={activeGuide}
            tables={tables}
            phaseIndex={guidePhaseIndex}
            onPhaseChange={setGuidePhaseIndex}
            onDismiss={dismissGuide}
            onPulseAddTable={setPulseAddTable}
          />
        )}

        {applyNotice && (
          <div className="pointer-events-auto absolute left-1/2 top-16 z-20 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-accent-green/40 bg-[rgba(12,17,28,0.95)] px-4 py-2.5 shadow-lg backdrop-blur">
            <span className="text-sm text-accent-green">{applyNotice}</span>
            <button
              type="button"
              onClick={() => setApplyNotice(null)}
              className="cursor-pointer text-xs text-ink-faint hover:text-ink"
            >
              Dismiss
            </button>
          </div>
        )}

        {showFirstVisitHint && tables.length === 0 && (
          <div className="pointer-events-auto absolute left-1/2 top-1/2 z-20 w-[min(360px,90%)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-accent-green/40 bg-[rgba(12,17,28,0.97)] p-5 shadow-2xl backdrop-blur">
            <h3 className="text-sm font-semibold text-ink">Getting started</h3>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-ink-muted">
              <li>
                <strong className="text-ink">Add a table</strong> — type a name in
                the left sidebar and press Enter (no code needed).
              </li>
              <li>
                <strong className="text-ink">Edit columns</strong> — click a table,
                then Edit, or double-click the card.
              </li>
              <li>
                <strong className="text-ink">Relationships</strong> — drag a line
                between two tables on the canvas.
              </li>
            </ul>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => dismissFirstVisitHint(true)}
                className="cursor-pointer rounded-lg bg-accent-green/15 px-3 py-1.5 text-xs font-semibold text-accent-green hover:bg-accent-green/25"
              >
                Open Playbook
              </button>
              <button
                type="button"
                onClick={() => dismissFirstVisitHint()}
                className="cursor-pointer rounded-lg border border-border-subtle px-3 py-1.5 text-xs text-ink-muted hover:text-ink"
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {tables.length === 0 && !showFirstVisitHint && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="text-sm text-ink-muted">Add a table from the panel, or use</p>
            <p className="mt-1 text-sm font-medium text-accent-purple">
              AI Suggest to generate a starter schema
            </p>
          </div>
        )}
      </div>

      {jsonShape && (
        <JsonSchemaDrawer
          erd={erd}
          shape={jsonShape}
          onClose={() => setJsonColumnId(null)}
        />
      )}

      {editingTable && !jsonShape && (
        <TableEditorDrawer
          erd={erd}
          tableId={editingTable}
          onClose={() => setEditingTableId(null)}
        />
      )}

      {aiOpen && (
        <AiSuggestPanel
          tables={tables}
          onClose={() => setAiOpen(false)}
          onApply={async (selected) => {
            const createdIds = await erd.applySuggestions(selected);
            setAiOpen(false);
            setApplyNotice(
              createdIds.length > 0
                ? `${createdIds.length} table${createdIds.length === 1 ? "" : "s"} added — double-click any table to edit`
                : null
            );
            setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 100);
          }}
        />
      )}

      {migrationsOpen && isOwner && (
        <MigrationsPanel
          diagramId={diagram.id}
          diagramName={diagram.name}
          tables={tables}
          relationships={relationships}
          onClose={() => setMigrationsOpen(false)}
        />
      )}

      {playbookOpen && (
        <PlaybookPanel
          diagramId={diagram.id}
          tables={tables}
          relationships={relationships}
          canManage={isOwner}
          onClose={() => setPlaybookOpen(false)}
          onStartGuide={startGuide}
        />
      )}

      {commentsOpen && (
        <CommentsPanel
          diagramId={diagram.id}
          currentUserId={currentUser.id}
          canModerate={isOwner}
          tables={tables}
          focusTableId={commentFocusTableId}
          onClose={() => {
            setCommentsOpen(false);
            setCommentFocusTableId(null);
          }}
        />
      )}

      {deleteConfirmId && deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border-subtle bg-surface p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-ink">Delete table?</h3>
            <p className="mt-2 text-sm text-ink-muted">
              Remove <span className="font-mono text-ink">{deleteTarget.name}</span> and
              all its columns? This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="cursor-pointer rounded-lg border border-border-subtle px-3 py-1.5 text-sm text-ink-muted hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteTable}
                className="cursor-pointer rounded-lg bg-red-500/20 px-3 py-1.5 text-sm font-semibold text-red-300 hover:bg-red-500/30"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ErdBuilder(props: {
  diagram: Diagram;
  initialTables: ErdTable[];
  initialRelationships: ErdRelationship[];
  userRole: WorkspaceRole;
  currentUser: { id: string; name: string };
}) {
  return (
    <ReactFlowProvider>
      <ErdBuilderInner {...props} />
    </ReactFlowProvider>
  );
}
