"use client";

import type { ReactNode } from "react";
import { useProjectStore } from "@/lib/projectStore";

export function Inspector({
  title,
  breadcrumb,
  children,
}: {
  title: string;
  breadcrumb?: string;
  children: ReactNode;
}) {
  const {
    inspectorWidth,
    setInspectorWidth,
    inspectorCollapsed,
    setInspectorCollapsed,
  } = useProjectStore();

  if (inspectorCollapsed) {
    return (
      <button
        type="button"
        onClick={() => setInspectorCollapsed(false)}
        className="flex w-8 flex-none cursor-pointer items-center justify-center border-l border-[#2E333D] bg-[#15181E] text-[10px] text-[#646D7E] hover:text-[#E7EAF0]"
        title="Expand inspector"
      >
        ⟨
      </button>
    );
  }

  return (
    <aside
      className="relative flex h-full flex-none flex-col border-l border-[#2E333D] bg-[#15181E]"
      style={{ width: inspectorWidth }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startW = inspectorWidth;
          function onMove(ev: MouseEvent) {
            const next = Math.min(480, Math.max(240, startW - (ev.clientX - startX)));
            setInspectorWidth(next);
          }
          function onUp() {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
          }
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        }}
        className="absolute left-0 top-0 z-10 h-full w-1 cursor-col-resize hover:bg-[#6E9BF5]/40"
      />
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#2E333D] bg-[#15181E] px-3 py-2.5">
        <div className="min-w-0">
          {breadcrumb && (
            <p className="truncate text-[10px] text-[#646D7E]">{breadcrumb}</p>
          )}
          <h3 className="truncate text-sm font-semibold text-[#E7EAF0]">
            {title}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setInspectorCollapsed(true)}
          className="cursor-pointer rounded px-1.5 text-[#646D7E] hover:text-[#E7EAF0]"
          aria-label="Collapse inspector"
        >
          ⟩
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-3">{children}</div>
    </aside>
  );
}
