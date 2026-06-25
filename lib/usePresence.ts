"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface PresencePeer {
  userId: string;
  name: string;
  color: string;
}

export interface PeerCursor {
  userId: string;
  name: string;
  color: string;
  x: number; // flow coords
  y: number;
  updatedAt: number;
}

const CURSOR_COLORS = [
  "#5aa6ff",
  "#8b7bff",
  "#ef8a52",
  "#1bb38c",
  "#e766a0",
  "#e3b341",
  "#58c2bd",
];

function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
}

const CURSOR_TTL_MS = 8000;

/**
 * Realtime presence + cursor broadcasting for a diagram.
 * - presence: who is currently viewing
 * - broadcast: live cursor positions in flow coordinates
 */
export function usePresence(
  diagramId: string,
  currentUser: { id: string; name: string }
) {
  const color = useMemo(() => colorForUser(currentUser.id), [currentUser.id]);
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const [cursors, setCursors] = useState<Record<string, PeerCursor>>({});
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`presence:${diagramId}`, {
      config: { presence: { key: currentUser.id } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{
          userId: string;
          name: string;
          color: string;
        }>();
        const list: PresencePeer[] = [];
        const seen = new Set<string>();
        for (const key of Object.keys(state)) {
          const meta = state[key]?.[0];
          if (!meta || seen.has(meta.userId)) continue;
          seen.add(meta.userId);
          list.push({ userId: meta.userId, name: meta.name, color: meta.color });
        }
        setPeers(list);
      })
      .on(
        "broadcast",
        { event: "cursor" },
        (payload: {
          payload: { userId: string; name: string; color: string; x: number; y: number };
        }) => {
          const c = payload.payload;
          if (c.userId === currentUser.id) return;
          setCursors((prev) => ({
            ...prev,
            [c.userId]: { ...c, updatedAt: Date.now() },
          }));
        }
      )
      .on(
        "broadcast",
        { event: "cursor-leave" },
        (payload: { payload: { userId: string } }) => {
          setCursors((prev) => {
            const next = { ...prev };
            delete next[payload.payload.userId];
            return next;
          });
        }
      )
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId: currentUser.id,
            name: currentUser.name,
            color,
          });
        }
      });

    return () => {
      void channel.send({
        type: "broadcast",
        event: "cursor-leave",
        payload: { userId: currentUser.id },
      });
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [diagramId, currentUser.id, currentUser.name, color]);

  // Prune stale cursors.
  useEffect(() => {
    const interval = setInterval(() => {
      setCursors((prev) => {
        const now = Date.now();
        let changed = false;
        const next: Record<string, PeerCursor> = {};
        for (const [id, c] of Object.entries(prev)) {
          if (now - c.updatedAt < CURSOR_TTL_MS) next[id] = c;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const sendCursor = useCallback(
    (x: number, y: number) => {
      const now = Date.now();
      if (now - lastSent.current < 45) return;
      lastSent.current = now;
      const channel = channelRef.current;
      if (!channel) return;
      void channel.send({
        type: "broadcast",
        event: "cursor",
        payload: { userId: currentUser.id, name: currentUser.name, color, x, y },
      });
    },
    [currentUser.id, currentUser.name, color]
  );

  return { peers, cursors, sendCursor, selfColor: color };
}
