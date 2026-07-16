"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PendingChange, PlanItemKind } from "@/lib/types";

type Toast = {
  id: string;
  title: string;
  detail?: string;
};

type PendingChangesValue = {
  changes: PendingChange[];
  addChange: (input: {
    kind: PlanItemKind;
    summary: string;
    label: string;
    payload?: Record<string, unknown>;
    diffHint?: string;
  }) => void;
  removeChange: (id: string) => void;
  clearChanges: () => void;
  chipLabel: string;
  toasts: Toast[];
  pushToast: (title: string, detail?: string) => void;
  dismissToast: (id: string) => void;
};

const PendingChangesContext = createContext<PendingChangesValue | null>(null);

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function PendingChangesProvider({ children }: { children: ReactNode }) {
  const [changes, setChanges] = useState<PendingChange[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addChange = useCallback(
    (input: {
      kind: PlanItemKind;
      summary: string;
      label: string;
      payload?: Record<string, unknown>;
      diffHint?: string;
    }) => {
      setChanges((prev) => [
        ...prev,
        {
          id: uid(),
          kind: input.kind,
          summary: input.summary,
          label: input.label,
          payload: input.payload ?? {},
          diffHint: input.diffHint,
        },
      ]);
    },
    []
  );

  const removeChange = useCallback((id: string) => {
    setChanges((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const clearChanges = useCallback(() => setChanges([]), []);

  const pushToast = useCallback((title: string, detail?: string) => {
    const id = uid();
    setToasts((prev) => [...prev, { id, title, detail }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const chipLabel = useMemo(() => {
    if (changes.length === 0) return "";
    const labels = changes.map((c) => c.label).slice(0, 3);
    const more = changes.length > 3 ? ` +${changes.length - 3}` : "";
    return `${changes.length} unsaved change${changes.length === 1 ? "" : "s"} · ${labels.join(", ")}${more}`;
  }, [changes]);

  const value = useMemo(
    () => ({
      changes,
      addChange,
      removeChange,
      clearChanges,
      chipLabel,
      toasts,
      pushToast,
      dismissToast,
    }),
    [
      changes,
      addChange,
      removeChange,
      clearChanges,
      chipLabel,
      toasts,
      pushToast,
      dismissToast,
    ]
  );

  return (
    <PendingChangesContext.Provider value={value}>
      {children}
    </PendingChangesContext.Provider>
  );
}

export function usePendingChanges() {
  const ctx = useContext(PendingChangesContext);
  if (!ctx) throw new Error("usePendingChanges must be used within provider");
  return ctx;
}
