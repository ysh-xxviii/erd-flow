"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  useViewport,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  SCHEMA_COLORS,
  tableColorHex,
  type Diagram,
  type ErdRelationship,
  type ErdTable,
} from "@/lib/types";
import { useErd } from "./useErd";
import { computeHoverFocus } from "@/lib/erdLayout";
import { findJsonShape } from "@/lib/jsonShapes";
import { EntityNode, NODE_W, nodeHeight } from "./EntityNode";
import { SidePanel } from "./SidePanel";
import { TableEditorDrawer } from "./TableEditorDrawer";
import { JsonSchemaDrawer } from "./JsonSchemaDrawer";
import { AiSuggestPanel } from "./AiSuggestPanel";

const nodeTypes: NodeTypes = { entity: EntityNode };

function parseColHandle(handle: string | null | undefined): string | null {
  if (!handle) return null;
  if (handle === "s-table" || handle === "t-table") return null;
  return handle.slice(2); // strip "s-" / "t-"
}

function ErdBuilderInner({
  diagram,
  initialTables,
  initialRelationships,
}: {
  diagram: Diagram;
  initialTables: ErdTable[];
  initialRelationships: ErdRelationship[];
}) {
  const erd = useErd(diagram.id, initialTables, initialRelationships);
  const { tables, relationships, saving, moveTable, addRelationship, deleteRelationship, relayoutAllTables } =
    erd;

  const { zoomIn, zoomOut, fitView, setCenter } = useReactFlow();
  const { zoom } = useViewport();

  const [selectedTableId, setSelectedTableId] = useState<string | null>(
    initialTables[0]?.id ?? null
  );
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [jsonColumnId, setJsonColumnId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
        },
      })),
    [fkRefs, openJsonSchema]
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
        return {
          id: r.id,
          source: r.source_table_id,
          target: r.target_table_id,
          sourceHandle: r.source_col_id ? `s-${r.source_col_id}` : "s-table",
          targetHandle: r.target_col_id ? `t-${r.target_col_id}` : "t-table",
          type: "default",
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
        if (!hoveredId) {
          return { ...n, zIndex: 2 };
        }
        const isActive = n.id === hoveredId;
        const isRelated = relatedIds.has(n.id);
        let className = "erd-node-dim";
        if (isActive) className = "erd-node-active";
        else if (isRelated) className = "erd-node-related";
        return {
          ...n,
          className,
          zIndex: isActive ? 10 : isRelated ? 4 : 1,
        };
      }),
    [nodes, hoveredId, relatedIds]
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

  const editingTable = useMemo(
    () => tables.find((t) => t.id === editingTableId) ?? null,
    [tables, editingTableId]
  );

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
        onHoverTable={setHoveredId}
        onFocusTable={focusTable}
        onOpenJsonShape={openJsonSchema}
        selectedJsonColumnId={jsonColumnId}
        onEditTable={(id) => {
          setJsonColumnId(null);
          setSelectedTableId(id);
          setEditingTableId(id);
        }}
        onOpenAi={() => setAiOpen(true)}
      />

      <div className="relative flex-1">
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
        </div>

        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onNodeDragStop={onNodeDragStop}
          onNodeMouseEnter={(_, node) => setHoveredId(node.id)}
          onNodeClick={(_, node) => setSelectedTableId(node.id)}
          onNodeDoubleClick={(_, node) => {
            setJsonColumnId(null);
            setSelectedTableId(node.id);
            setEditingTableId(node.id);
          }}
          nodeTypes={nodeTypes}
          fitView
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
        </ReactFlow>

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
          drag header to move · drag canvas to pan · scroll to zoom · hover to focus
        </div>

        {tables.length === 0 && (
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
          table={editingTable}
          onClose={() => setEditingTableId(null)}
        />
      )}

      {aiOpen && (
        <AiSuggestPanel
          tables={tables}
          onClose={() => setAiOpen(false)}
          onApply={async (selected) => {
            await erd.applySuggestions(selected);
            setAiOpen(false);
            setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 100);
          }}
        />
      )}
    </div>
  );
}

export function ErdBuilder(props: {
  diagram: Diagram;
  initialTables: ErdTable[];
  initialRelationships: ErdRelationship[];
}) {
  return (
    <ReactFlowProvider>
      <ErdBuilderInner {...props} />
    </ReactFlowProvider>
  );
}
