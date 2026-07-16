"use client";

import type { ReactNode } from "react";
import type { ProjectSection } from "@/lib/types";
import { useProjectStore } from "@/lib/projectStore";

const SECTIONS: {
  id: ProjectSection;
  label: string;
  icon: ReactNode;
}[] = [
  {
    id: "project",
    label: "Project",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 7h16M4 12h16M4 17h10" />
      </svg>
    ),
  },
  {
    id: "backend",
    label: "Backend",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
        <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
      </svg>
    ),
  },
  {
    id: "frontend",
    label: "Frontend",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <path d="M3 8h18M8 18h8" />
      </svg>
    ),
  },
  {
    id: "database",
    label: "Database",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3c-4.4 0-8 1.3-8 3v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6c0-1.7-3.6-3-8-3z" />
        <path d="M4 9c0 1.7 3.6 3 8 3s8-1.3 8-3" />
      </svg>
    ),
  },
  {
    id: "plans",
    label: "Plans",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 12h6M9 16h4" />
      </svg>
    ),
  },
];

export function SectionRail() {
  const { activeSection, setActiveSection, setPlanReviewMode } = useProjectStore();

  return (
    <nav
      className="flex w-12 flex-none flex-col items-center gap-1 border-r border-[#2E333D] bg-[#15181E] py-2"
      aria-label="Sections"
    >
      {SECTIONS.map((s) => {
        const active = activeSection === s.id;
        return (
          <button
            key={s.id}
            type="button"
            title={s.label}
            aria-label={s.label}
            aria-current={active ? "page" : undefined}
            onClick={() => {
              setActiveSection(s.id);
              if (s.id !== "plans") setPlanReviewMode(false);
            }}
            className={`flex h-10 w-10 cursor-pointer flex-col items-center justify-center rounded-md transition-colors ${
              active
                ? "bg-[#1A1D23] text-[#6E9BF5]"
                : "text-[#646D7E] hover:bg-[#1A1D23] hover:text-[#9AA3B2]"
            }`}
          >
            {s.icon}
          </button>
        );
      })}
    </nav>
  );
}
