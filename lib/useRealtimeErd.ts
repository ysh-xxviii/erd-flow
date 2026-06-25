"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AccentColor, ErdTable, TableCategory } from "@/lib/types";

type ErdTableUpdate = Partial<
  Pick<
    ErdTable,
    "name" | "color" | "category" | "description" | "pos_x" | "pos_y"
  >
>;

/**
 * Subscribes to Supabase postgres_changes for a diagram's ERD tables and keeps
 * local state in sync with edits made by other collaborators.
 *
 * Strategy: lightweight in-place patch for erd_tables UPDATE events (keeps
 * remote drags/renames smooth), and a debounced full reload for structural
 * changes (insert/delete of tables, any column or relationship change).
 */
export function useRealtimeErd(
  diagramId: string,
  erd: {
    reload: () => Promise<void> | void;
    setTables: React.Dispatch<React.SetStateAction<ErdTable[]>>;
  }
) {
  const reloadRef = useRef(erd.reload);
  const setTablesRef = useRef(erd.setTables);
  reloadRef.current = erd.reload;
  setTablesRef.current = erd.setTables;

  useEffect(() => {
    const supabase = createClient();
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleReload = () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        void reloadRef.current();
      }, 300);
    };

    const patchTable = (row: Record<string, unknown>) => {
      const id = row.id as string;
      const patch: ErdTableUpdate = {};
      if (typeof row.name === "string") patch.name = row.name;
      if (typeof row.color === "string") patch.color = row.color as AccentColor;
      if (typeof row.category === "string")
        patch.category = row.category as TableCategory;
      if (typeof row.description === "string")
        patch.description = row.description;
      if (typeof row.pos_x === "number") patch.pos_x = row.pos_x;
      if (typeof row.pos_y === "number") patch.pos_y = row.pos_y;

      setTablesRef.current((prev) => {
        let found = false;
        const next = prev.map((t) => {
          if (t.id !== id) return t;
          found = true;
          return { ...t, ...patch };
        });
        // Unknown table (e.g. created elsewhere) -> fall back to reload.
        if (!found) scheduleReload();
        return next;
      });
    };

    const channel = supabase
      .channel(`erd:${diagramId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "erd_tables",
          filter: `diagram_id=eq.${diagramId}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE" && payload.new) {
            patchTable(payload.new as Record<string, unknown>);
          } else {
            scheduleReload();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "erd_columns" },
        () => scheduleReload()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "erd_relationships",
          filter: `diagram_id=eq.${diagramId}`,
        },
        () => scheduleReload()
      )
      .subscribe();

    return () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      void supabase.removeChannel(channel);
    };
  }, [diagramId]);
}
