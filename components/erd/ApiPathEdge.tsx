"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import type { ApiRequest, HttpMethod } from "@/lib/types";

const METHOD_COLOR: Record<HttpMethod, string> = {
  GET: "#1bb38c",
  POST: "#e3b341",
  PUT: "#5aa6ff",
  PATCH: "#8b7bff",
  DELETE: "#e7536a",
};

export interface ApiPathEdgeData {
  endpoints: ApiRequest[];
  onOpen: () => void;
}

export function ApiPathEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
  className,
}: EdgeProps & { className?: string }) {
  const edgeData = data as ApiPathEdgeData | undefined;
  const endpoints = edgeData?.endpoints ?? [];
  const onOpen = edgeData?.onOpen;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  if (endpoints.length === 0) {
    return (
      <BaseEdge
        id={id}
        path={edgePath}
        style={style}
        markerEnd={markerEnd}
        className={className}
      />
    );
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={style}
        markerEnd={markerEnd}
        className={className}
      />
      <EdgeLabelRenderer>
        <div
          className="group nodrag nopan"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
        >
          <button
            type="button"
            title={`${endpoints.length} API endpoint${endpoints.length === 1 ? "" : "s"} on this path`}
            onClick={(e) => {
              e.stopPropagation();
              onOpen?.();
            }}
            className="flex cursor-pointer items-center gap-1 rounded-full border border-[#1bb38c]/40 bg-[#0c111c]/95 px-2 py-0.5 text-[10px] font-semibold text-[#1bb38c] shadow-md transition-colors hover:bg-[#1bb38c]/20"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1bb38c"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 3v12" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M8.59 13.51l6.83-3.98" />
              <path d="M15.41 6.49l-6.82 3.98" />
            </svg>
            {endpoints.length}
          </button>

          {/* Invisible bridge + tooltip: group-hover keeps tooltip open across the gap */}
          <div className="absolute left-1/2 top-full hidden w-max -translate-x-1/2 pt-1 group-hover:block">
            <div
              className="min-w-[160px] max-w-[220px] rounded-lg border border-border-subtle bg-surface p-2 shadow-xl"
              role="tooltip"
            >
              <p className="mb-1.5 text-[9px] uppercase tracking-wide text-ink-faint">
                API on path
              </p>
              <ul className="space-y-1">
                {endpoints.map((ep) => (
                  <li
                    key={ep.id}
                    className="flex items-center gap-1.5 truncate text-[10px] text-ink-muted"
                  >
                    <span
                      className="flex-none font-mono text-[8px] font-bold"
                      style={{ color: METHOD_COLOR[ep.method] }}
                    >
                      {ep.method}
                    </span>
                    <span className="truncate">{ep.name}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[9px] text-ink-faint">
                Click to open in API panel
              </p>
            </div>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
