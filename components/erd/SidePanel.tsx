"use client";

import { useState } from "react";
import { tableColorHex, type ErdTable } from "@/lib/types";
import { collectJsonShapes } from "@/lib/jsonShapes";
import { type useErd } from "./useErd";

type Erd = ReturnType<typeof useErd>;

export function SidePanel({
  erd,
  diagramName,
  hoveredId,
  relatedIds,
  editingTableId,
  onHoverTable,
  onFocusTable,
  onOpenJsonShape,
  selectedJsonColumnId,
  onEditTable,
  onDeleteTable,
  onOpenAi,
  onOpenPlaybook,
  pulseAddTable,
}: {
  erd: Erd;
  diagramName: string;
  hoveredId: string | null;
  relatedIds: Set<string>;
  editingTableId: string | null;
  onHoverTable: (id: string) => void;
  onFocusTable: (id: string) => void;
  onOpenJsonShape: (columnId: string) => void;
  selectedJsonColumnId: string | null;
  onEditTable: (id: string) => void;
  onDeleteTable: (id: string) => void;
  onOpenAi: () => void;
  onOpenPlaybook: () => void;
  pulseAddTable?: boolean;
}) {
  const [newTableName, setNewTableName] = useState("");

  async function handleAddTable(e: React.FormEvent) {
    e.preventDefault();
    const name = newTableName.trim();
    if (!name) return;
    const t = await erd.addTable(name);
    setNewTableName("");
    onEditTable(t.id);
  }

  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-[#1d2740] bg-[#0c111c]">
      {/* header */}
      <div className="border-b border-[#1d2740] p-4">
        <h1 className="truncate font-display text-[15px] font-semibold text-ink">
          {diagramName}
        </h1>
        <button
          type="button"
          onClick={onOpenPlaybook}
          className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-accent-green/50 bg-accent-green/10 px-3 py-2 text-sm font-semibold text-accent-green transition-colors hover:bg-accent-green/20"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          Playbook
        </button>
        <button
          type="button"
          onClick={onOpenAi}
          className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-accent-purple/50 bg-accent-purple/10 px-3 py-2 text-sm font-semibold text-accent-purple transition-colors hover:bg-accent-purple/20"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m12 3 1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
            <path d="M19 14v4M21 16h-4M5 4v3M6.5 5.5h-3" />
          </svg>
          AI Suggest Tables
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-3.5">
        {(() => {
          const core = erd.tables.filter(
            (t) => (t.category ?? "core") === "core"
          );
          const enums = erd.tables.filter((t) => t.category === "enum");
          const framework = erd.tables.filter((t) => t.category === "framework");
          const jsonbShapes = collectJsonShapes(erd.tables);

          if (erd.tables.length === 0) {
            return (
              <p className="px-4 py-2 text-xs text-[#5e6a85]">
                No tables yet. Add one below or use AI Suggest.
              </p>
            );
          }

          return (
            <>
              <Section label="Core domain">
                {core.map((t) => (
                  <NavItem
                    key={t.id}
                    table={t}
                    hoveredId={hoveredId}
                    relatedIds={relatedIds}
                    active={editingTableId === t.id}
                    onHover={() => onHoverTable(t.id)}
                    onClick={() => onFocusTable(t.id)}
                    onEdit={() => onEditTable(t.id)}
                    onDelete={() => onDeleteTable(t.id)}
                  />
                ))}
              </Section>

              {jsonbShapes.length > 0 && (
                <Section label="JSONB shapes">
                  {jsonbShapes.map((s) => (
                    <JsonbNavItem
                      key={s.columnId}
                      shape={s}
                      hoveredId={hoveredId}
                      relatedIds={relatedIds}
                      selected={selectedJsonColumnId === s.columnId}
                      onHover={() => onHoverTable(s.tableId)}
                      onClick={() => onOpenJsonShape(s.columnId)}
                    />
                  ))}
                </Section>
              )}

              {enums.length > 0 && (
                <Section label="Enums">
                  {enums.map((t) => (
                    <NavItem
                      key={t.id}
                      table={t}
                      hoveredId={hoveredId}
                      relatedIds={relatedIds}
                      active={editingTableId === t.id}
                      onHover={() => onHoverTable(t.id)}
                      onClick={() => onFocusTable(t.id)}
                      onEdit={() => onEditTable(t.id)}
                      onDelete={() => onDeleteTable(t.id)}
                    />
                  ))}
                </Section>
              )}

              {framework.length > 0 && (
                <Section label="Framework / infra">
                  {framework.map((t) => (
                    <NavItem
                      key={t.id}
                      table={t}
                      hoveredId={hoveredId}
                      relatedIds={relatedIds}
                      active={editingTableId === t.id}
                      onHover={() => onHoverTable(t.id)}
                      onClick={() => onFocusTable(t.id)}
                      onEdit={() => onEditTable(t.id)}
                      onDelete={() => onDeleteTable(t.id)}
                    />
                  ))}
                </Section>
              )}
            </>
          );
        })()}

        <form
          onSubmit={handleAddTable}
          className={`mt-3 flex gap-2 px-4 ${pulseAddTable ? "sidebar-add-table-pulse" : ""}`}
        >
          <input
            value={newTableName}
            onChange={(e) => setNewTableName(e.target.value)}
            placeholder="new_table"
            aria-label="New table name"
            className="w-full rounded-md border border-[#25304a] bg-canvas px-2.5 py-1.5 font-mono text-sm text-ink placeholder:text-ink-faint focus:border-accent-blue focus:outline-none"
          />
          <button
            type="submit"
            className="cursor-pointer rounded-md bg-accent-blue px-3 py-1.5 text-sm font-semibold text-canvas transition-colors hover:bg-[#79b6ff]"
          >
            Add
          </button>
        </form>

        <p className="mt-2 px-4 text-[10px] leading-relaxed text-[#5e6a85]">
          No code needed — type a name and press Enter.
        </p>

        <p className="mt-3 px-4 text-[10px] leading-relaxed text-[#46506a]">
          Click to focus · Edit icon or double-click to change columns · drag lines
          for relationships.
        </p>
      </div>
    </aside>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <div className="px-4 pb-1.5 text-[10px] uppercase tracking-[1.5px] text-[#5e6a85]">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function navItemClass(
  tableId: string,
  hoveredId: string | null,
  relatedIds: Set<string>,
  active?: boolean
): string {
  const base =
    "mx-2 flex w-[calc(100%-16px)] cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[12px] transition-[opacity,background-color,color,box-shadow]";

  if (active) {
    return `${base} bg-[#16203a] text-[#e8eefc] opacity-100 ring-1 ring-accent-blue/40 ring-inset`;
  }

  if (!hoveredId) {
    return `${base} text-[#9aa6c2] hover:bg-[#141c2e] hover:text-ink`;
  }
  if (tableId === hoveredId) {
    return `${base} bg-[#16203a] text-[#e8eefc] opacity-100`;
  }
  if (relatedIds.has(tableId)) {
    return `${base} text-[#9aa6c2] opacity-100`;
  }
  return `${base} text-[#9aa6c2] opacity-[0.26]`;
}

function NavItem({
  table,
  hoveredId,
  relatedIds,
  active,
  onHover,
  onClick,
  onEdit,
  onDelete,
}: {
  table: ErdTable;
  hoveredId: string | null;
  relatedIds: Set<string>;
  active?: boolean;
  onHover: () => void;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group mx-2 flex w-[calc(100%-16px)] items-center gap-1">
      <button
        type="button"
        onClick={onClick}
        onDoubleClick={onEdit}
        onMouseEnter={onHover}
        title="Click to focus · double-click to edit"
        className={`${navItemClass(table.id, hoveredId, relatedIds, active)} min-w-0 flex-1`}
      >
      <span
        className="h-2 w-2 flex-none rounded-[2px]"
        style={{
          background: tableColorHex({
            color: table.color,
            category: table.category ?? "core",
          }),
        }}
      />
      <span className="flex-1 truncate font-mono">{table.name}</span>
      <span className="text-[10px] text-[#5e6a85]">{table.columns.length}</span>
      </button>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${table.name}`}
        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#5e6a85] transition-colors hover:bg-[#141c2e] hover:text-ink"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${table.name}`}
        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#5e6a85] transition-colors hover:bg-red-500/15 hover:text-red-300"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
        </svg>
      </button>
    </div>
  );
}

function JsonbNavItem({
  shape,
  hoveredId,
  relatedIds,
  selected,
  onHover,
  onClick,
}: {
  shape: { columnId: string; tableId: string; label: string; index: number };
  hoveredId: string | null;
  relatedIds: Set<string>;
  selected: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  const base = navItemClass(shape.tableId, hoveredId, relatedIds);
  const selectedClass = selected
    ? " ring-1 ring-white/75 ring-inset"
    : "";

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onHover}
      className={`${base}${selectedClass}`}
    >
      <span className="w-7 flex-none font-mono text-[11px] text-accent-purple">
        7.{shape.index}
      </span>
      <span className="flex-1 truncate font-mono">{shape.label}</span>
    </button>
  );
}
