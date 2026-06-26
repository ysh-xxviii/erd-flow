"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  SCHEMA_COLORS,
  categoryTag,
  tableColorHex,
  type AccentColor,
  type ErdColumn,
  type ErdConstraint,
  type TableCategory,
} from "@/lib/types";
import { isJsonColumn } from "@/lib/jsonShapes";

export const NODE_W = 300;
export const HEADER_H = 42;
export const DESC_H = 28;
export const ROW_H = 30;
export const FOOTER_ROW_H = 22;

export interface EntityNodeData {
  name: string;
  color: AccentColor;
  category: TableCategory;
  description: string;
  constraints: ErdConstraint[];
  columns: ErdColumn[];
  fkRefs: Record<string, string>;
  onJsonClick?: (columnId: string) => void;
  commentCount?: number;
  onCommentClick?: () => void;
  endpointCount?: number;
  onEndpointClick?: () => void;
  [key: string]: unknown;
}

export function nodeHeight(data: {
  description?: string;
  constraints?: ErdConstraint[];
  columns: ErdColumn[];
}): number {
  const descH = data.description?.trim() ? DESC_H : 0;
  const footerH =
    (data.constraints?.length ?? 0) > 0
      ? FOOTER_ROW_H * (data.constraints?.length ?? 0) + 4
      : 0;
  return HEADER_H + descH + data.columns.length * ROW_H + footerH;
}

function enumLabelColor(name: string, label?: string | null): string {
  const v = (label ?? name).toLowerCase();
  if (v.includes("fail") || v.includes("error") || v.includes("cancel"))
    return "#ef4444";
  if (
    v.includes("publish") ||
    v.includes("active") ||
    v.includes("success") ||
    v.includes("deliver")
  )
    return "#1bb38c";
  if (v.includes("generat") || v.includes("pending") || v.includes("ship"))
    return "#5aa6ff";
  if (v.includes("draft")) return "#7e8aa6";
  return "#9aa6c2";
}

function hexToRgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function EntityNodeComponent({ data }: NodeProps) {
  const d = data as EntityNodeData;
  const category = d.category ?? "core";
  const isEnum = category === "enum";
  const accent = tableColorHex({ color: d.color, category });
  const tag = categoryTag(category);
  const hasDesc = !!d.description?.trim();
  const descOffset = hasDesc ? DESC_H : 0;

  return (
    <div
      className="erd-card"
      style={{
        ["--accent" as string]: accent,
        width: NODE_W,
        background: SCHEMA_COLORS.cardBg,
        borderStyle: "solid",
        borderTopWidth: 3,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderLeftWidth: 1,
        borderTopColor: accent,
        borderRightColor: SCHEMA_COLORS.cardBorder,
        borderBottomColor: SCHEMA_COLORS.cardBorder,
        borderLeftColor: SCHEMA_COLORS.cardBorder,
        borderRadius: 9,
        overflow: "hidden",
        boxShadow: "0 8px 26px rgba(0,0,0,0.45)",
        fontFamily: "var(--font-jetbrains), ui-monospace, monospace",
      }}
    >
      <Handle
        id="t-table"
        type="target"
        position={Position.Left}
        style={{ top: HEADER_H / 2, opacity: 0 }}
      />
      <Handle
        id="t-table-R"
        type="target"
        position={Position.Right}
        style={{ top: HEADER_H / 2, opacity: 0 }}
      />
      <Handle
        id="s-table"
        type="source"
        position={Position.Right}
        style={{ top: HEADER_H / 2, opacity: 0 }}
      />
      <Handle
        id="s-table-L"
        type="source"
        position={Position.Left}
        style={{ top: HEADER_H / 2, opacity: 0 }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          height: HEADER_H,
          padding: "0 12px",
          background: hexToRgba(accent, 0.13),
          cursor: "grab",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: 2,
              flex: "none",
              background: accent,
            }}
          />
          <span
            style={{
              fontWeight: 600,
              fontSize: 13.5,
              letterSpacing: ".2px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {d.name}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "none" }}>
          {(d.commentCount ?? 0) > 0 && (
            <span
              role="button"
              tabIndex={0}
              title={`${d.commentCount} open comment${d.commentCount === 1 ? "" : "s"}`}
              onClick={(e) => {
                e.stopPropagation();
                d.onCommentClick?.();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  d.onCommentClick?.();
                }
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                fontSize: 9.5,
                fontWeight: 600,
                color: "#e3b341",
                background: "rgba(227,179,65,0.16)",
                padding: "2px 6px",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#e3b341" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {d.commentCount}
            </span>
          )}
          {(d.endpointCount ?? 0) > 0 ? (
            <span
              role="button"
              tabIndex={0}
              title={`${d.endpointCount} API endpoint${d.endpointCount === 1 ? "" : "s"}`}
              onClick={(e) => {
                e.stopPropagation();
                d.onEndpointClick?.();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  d.onEndpointClick?.();
                }
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                fontSize: 9.5,
                fontWeight: 600,
                color: "#1bb38c",
                background: "rgba(27,179,140,0.16)",
                padding: "2px 6px",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1bb38c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 3v12" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M8.59 13.51l6.83-3.98" />
                <path d="M15.41 6.49l-6.82 3.98" />
              </svg>
              {d.endpointCount}
            </span>
          ) : d.onEndpointClick ? (
            <span
              role="button"
              tabIndex={0}
              title="Create API for this table"
              onClick={(e) => {
                e.stopPropagation();
                d.onEndpointClick?.();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  d.onEndpointClick?.();
                }
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                fontSize: 9.5,
                fontWeight: 600,
                color: "#1bb38c",
                background: "rgba(27,179,140,0.08)",
                padding: "2px 6px",
                borderRadius: 4,
                cursor: "pointer",
                opacity: 0.85,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1bb38c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              API
            </span>
          ) : null}
          <span
            style={{
              fontSize: 9,
              letterSpacing: ".5px",
              textTransform: "uppercase",
              color: accent,
              background: hexToRgba(accent, 0.14),
              padding: "2px 7px",
              borderRadius: 4,
              flex: "none",
            }}
          >
            {tag}
          </span>
        </div>
      </div>

      {hasDesc && (
        <div
          style={{
            height: DESC_H,
            padding: "0 12px",
            display: "flex",
            alignItems: "center",
            fontSize: 10.5,
            fontStyle: "italic",
            color: "#7e8aa6",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {d.description}
        </div>
      )}

      {d.columns.length === 0 && (
        <div style={{ padding: "8px 12px", fontSize: 11, color: "#5e6a85" }}>
          No columns yet
        </div>
      )}
      {d.columns.map((c) => (
        <ColumnRow
          key={c.id}
          col={c}
          accent={accent}
          isEnum={isEnum}
          fkRef={d.fkRefs[c.id]}
          onJsonClick={d.onJsonClick}
        />
      ))}

      {d.constraints.length > 0 && (
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(0,0,0,0.15)",
          }}
        >
          {d.constraints.map((c) => (
            <div
              key={`${c.kind}-${c.columns.join(",")}`}
              style={{
                height: FOOTER_ROW_H,
                padding: "0 11px",
                display: "flex",
                alignItems: "center",
                fontSize: 10,
                color: "#5e6a85",
                letterSpacing: ".3px",
              }}
            >
              <span style={{ color: "#7e8aa6", marginRight: 4 }}>
                {c.kind === "unique" ? "UQ" : "IDX"}
              </span>
              ({c.columns.join(", ")})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const handleCenter = { top: "50%", transform: "translateY(-50%)" } as const;

function ColumnRow({
  col,
  accent,
  isEnum,
  fkRef,
  onJsonClick,
}: {
  col: ErdColumn;
  accent: string;
  isEnum: boolean;
  fkRef?: string;
  onJsonClick?: (columnId: string) => void;
}) {
  const icon = isEnum ? "" : col.is_pk ? "◆" : col.is_fk ? "◇" : "";
  const iconColor = col.is_pk
    ? SCHEMA_COLORS.pk
    : col.is_fk
      ? SCHEMA_COLORS.fk
      : "transparent";
  const nameColor = isEnum
    ? "#c4cee0"
    : col.is_pk
      ? "#f0f4fc"
      : col.is_fk
        ? "#9ec8ff"
        : "#c4cee0";
  const isJson = isJsonColumn(col);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: ROW_H,
        padding: "0 11px",
        borderBottom: "1px solid rgba(255,255,255,0.045)",
        fontSize: 12.5,
      }}
    >
      <Handle
        id={`t-${col.id}`}
        type="target"
        position={Position.Left}
        style={{ ...handleCenter, background: SCHEMA_COLORS.fk }}
        className="erd-col-handle"
      />
      <Handle
        id={`t-${col.id}-R`}
        type="target"
        position={Position.Right}
        style={{ ...handleCenter, background: SCHEMA_COLORS.fk }}
        className="erd-col-handle"
      />
      <Handle
        id={`s-${col.id}`}
        type="source"
        position={Position.Right}
        style={{ ...handleCenter, background: accent }}
        className="erd-col-handle"
      />
      <Handle
        id={`s-${col.id}-L`}
        type="source"
        position={Position.Left}
        style={{ ...handleCenter, background: accent }}
        className="erd-col-handle"
      />

      <span
        style={{
          width: 12,
          textAlign: "center",
          flex: "none",
          fontSize: 11,
          color: iconColor,
        }}
      >
        {icon}
      </span>
      <span
        style={{
          flex: "1 1 auto",
          minWidth: 24,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          color: nameColor,
          fontWeight: col.is_pk ? 600 : 400,
        }}
      >
        {col.name}
        {!isEnum && col.is_nullable ? "?" : ""}
      </span>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flex: "none",
          maxWidth: 168,
          overflow: "hidden",
        }}
      >
        {isEnum ? (
          <>
            <span
              style={{
                color: SCHEMA_COLORS.type,
                fontSize: 11,
                flex: "none",
              }}
            >
              {col.data_type}
            </span>
            {(col.label || col.name) && (
              <span
                style={{
                  color: enumLabelColor(col.name, col.label),
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: `${enumLabelColor(col.name, col.label)}22`,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 90,
                }}
              >
                {col.label ?? col.name}
              </span>
            )}
          </>
        ) : fkRef ? (
          <span
            style={{
              color: SCHEMA_COLORS.fk,
              fontSize: 10.5,
              opacity: 0.85,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            → {fkRef}
          </span>
        ) : (
          <>
            <span
              role={isJson ? "button" : undefined}
              tabIndex={isJson ? 0 : undefined}
              onClick={
                isJson
                  ? (e) => {
                      e.stopPropagation();
                      onJsonClick?.(col.id);
                    }
                  : undefined
              }
              onKeyDown={
                isJson
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        onJsonClick?.(col.id);
                      }
                    }
                  : undefined
              }
              style={{
                color: isJson ? "#1bb38c" : SCHEMA_COLORS.type,
                fontSize: isJson ? 11.5 : 11.5,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                cursor: isJson ? "pointer" : undefined,
                borderBottom: isJson ? "1px dotted #1bb38c" : undefined,
              }}
              title={isJson ? "View JSON schema" : undefined}
            >
              {col.data_type}
            </span>
            {col.default_value && (
              <span
                style={{
                  color: "#7e8aa6",
                  fontSize: 10,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {col.default_value}
              </span>
            )}
          </>
        )}
      </span>
    </div>
  );
}

export const EntityNode = memo(EntityNodeComponent);
