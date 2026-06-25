"use client";

import { useReactFlow, useViewport } from "@xyflow/react";
import type { PeerCursor, PresencePeer } from "@/lib/usePresence";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Renders remote collaborators' live cursors over the canvas. */
export function PresenceCursors({ cursors }: { cursors: Record<string, PeerCursor> }) {
  const { flowToScreenPosition } = useReactFlow();
  useViewport(); // re-render on pan/zoom so screen positions stay correct
  const list = Object.values(cursors);
  if (list.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {list.map((c) => {
        const p = flowToScreenPosition({ x: c.x, y: c.y });
        return (
          <div
            key={c.userId}
            className="absolute transition-transform duration-75 ease-linear"
            style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
          >
            <svg width="20" height="22" viewBox="0 0 20 22" fill="none" aria-hidden="true">
              <path
                d="M2 2L2 16.5L6 12.8L8.8 18.5L11.5 17.2L8.7 11.5L14 11L2 2Z"
                fill={c.color}
                stroke="rgba(0,0,0,0.35)"
                strokeWidth="1"
              />
            </svg>
            <span
              className="mt-0.5 inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium text-white shadow"
              style={{ backgroundColor: c.color }}
            >
              {c.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Stack of avatars for everyone currently viewing the diagram. */
export function PresenceAvatars({
  peers,
  selfId,
}: {
  peers: PresencePeer[];
  selfId: string;
}) {
  if (peers.length === 0) return null;
  const ordered = [...peers].sort((a) =>
    a.userId === selfId ? -1 : 1
  );
  const shown = ordered.slice(0, 5);
  const extra = ordered.length - shown.length;

  return (
    <div className="flex items-center -space-x-2">
      {shown.map((p) => (
        <div
          key={p.userId}
          title={p.userId === selfId ? `${p.name} (you)` : p.name}
          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0c111c] text-[10px] font-semibold text-white shadow"
          style={{ backgroundColor: p.color }}
        >
          {initials(p.name)}
        </div>
      ))}
      {extra > 0 && (
        <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0c111c] bg-[#2a3550] text-[10px] font-semibold text-[#cdd7ec]">
          +{extra}
        </div>
      )}
    </div>
  );
}
