"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DiagramComment, ErdTable } from "@/lib/types";
import { SlideOver } from "./SlideOver";
import {
  addComment,
  deleteComment,
  listComments,
  setCommentResolved,
} from "@/lib/comments";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function CommentsPanel({
  diagramId,
  currentUserId,
  canModerate,
  tables,
  focusTableId,
  onClose,
}: {
  diagramId: string;
  currentUserId: string;
  canModerate: boolean;
  tables: ErdTable[];
  focusTableId: string | null;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<DiagramComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [body, setBody] = useState("");
  const [targetTableId, setTargetTableId] = useState<string | "">(
    focusTableId ?? ""
  );
  const [posting, setPosting] = useState(false);

  const tableName = useCallback(
    (id: string | null) => tables.find((t) => t.id === id)?.name ?? null,
    [tables]
  );

  const reload = useCallback(async () => {
    try {
      const rows = await listComments(diagramId);
      setComments(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load comments");
    } finally {
      setLoading(false);
    }
  }, [diagramId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Keep compose target in sync when panel opens from a table badge or selection.
  useEffect(() => {
    setTargetTableId(focusTableId ?? "");
  }, [focusTableId]);

  // Live updates from collaborators.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`comments:${diagramId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "diagram_comments",
          filter: `diagram_id=eq.${diagramId}`,
        },
        () => void reload()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [diagramId, reload]);

  const endRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => {
    let list = comments.filter((c) => (showResolved ? true : !c.resolved));
    if (focusTableId) {
      list = list.filter(
        (c) => c.table_id === focusTableId || c.table_id === null
      );
    }
    return list;
  }, [comments, showResolved, focusTableId]);

  const grouped = useMemo(() => {
    const groups = new Map<string, DiagramComment[]>();
    for (const c of visible) {
      const key = c.table_id ?? "__general__";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }
    return Array.from(groups.entries());
  }, [visible]);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    setError(null);
    try {
      await addComment({
        diagramId,
        tableId: targetTableId || null,
        body: body.trim(),
      });
      setBody("");
      await reload();
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post comment");
    } finally {
      setPosting(false);
    }
  }

  async function handleResolve(c: DiagramComment) {
    const nextResolved = !c.resolved;
    setComments((prev) =>
      prev.map((x) =>
        x.id === c.id ? { ...x, resolved: nextResolved } : x
      )
    );
    setError(null);
    try {
      await setCommentResolved(c.id, nextResolved);
    } catch (e) {
      setComments((prev) =>
        prev.map((x) =>
          x.id === c.id ? { ...x, resolved: c.resolved } : x
        )
      );
      setError(
        e instanceof Error ? e.message : "Could not resolve comment"
      );
    }
  }

  async function handleDelete(c: DiagramComment) {
    setComments((prev) => prev.filter((x) => x.id !== c.id));
    try {
      await deleteComment(c.id);
    } catch {
      void reload();
    }
  }

  const openCount = comments.filter((c) => !c.resolved).length;

  return (
    <SlideOver onClose={onClose}>
        <header className="border-b border-border-subtle p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e3b341" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <h2 className="text-base font-semibold text-ink">Comments</h2>
              <span className="rounded bg-card px-1.5 py-0.5 text-[10px] text-ink-muted">
                {openCount} open
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              aria-label="Close"
              className="cursor-pointer rounded-md p-1.5 text-ink-faint transition-colors hover:bg-card hover:text-ink"
            >
              ×
            </button>
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-[11px] text-ink-muted">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="h-3.5 w-3.5 cursor-pointer accent-accent-green"
            />
            Show resolved
          </label>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <p
              role="alert"
              className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
            >
              {error}
            </p>
          )}

          {loading ? (
            <p className="text-sm text-ink-faint">Loading comments…</p>
          ) : visible.length === 0 ? (
            <p className="text-sm leading-relaxed text-ink-faint">
              No comments yet. Leave feedback for your team below — attach it to a
              specific table or post a general note.
            </p>
          ) : (
            <div className="space-y-4">
              {grouped.map(([key, list]) => (
                <div key={key}>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                    {key === "__general__"
                      ? "General"
                      : tableName(key) ?? "Unknown table"}
                  </p>
                  <ul className="space-y-2">
                    {list.map((c) => (
                      <li
                        key={c.id}
                        className={`rounded-xl border p-3 ${
                          c.resolved
                            ? "border-accent-green/30 bg-accent-green/5"
                            : "border-border-subtle bg-card"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-ink">
                            {c.author_name ?? "Someone"}
                          </span>
                          <span className="text-[10px] text-ink-faint">
                            {timeAgo(c.created_at)}
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-muted">
                          {c.body}
                        </p>
                        <div className="mt-2 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleResolve(c)}
                            className="cursor-pointer text-[11px] font-semibold text-accent-green hover:underline"
                          >
                            {c.resolved ? "Reopen" : "Resolve"}
                          </button>
                          {(canModerate || c.author_id === currentUserId) && (
                            <button
                              type="button"
                              onClick={() => handleDelete(c)}
                              className="cursor-pointer text-[11px] text-ink-faint hover:text-red-300"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <form
          onSubmit={handlePost}
          className="border-t border-border-subtle p-3"
        >
          <select
            value={targetTableId}
            onChange={(e) => setTargetTableId(e.target.value)}
            className="mb-2 w-full cursor-pointer rounded-md border border-border-subtle bg-card px-2 py-1.5 text-xs text-ink"
          >
            <option value="">General comment</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                On table: {t.name}
              </option>
            ))}
          </select>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a comment…"
            rows={2}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                void handlePost(e);
              }
            }}
            className="w-full resize-none rounded-md border border-border-subtle bg-canvas px-2 py-1.5 text-sm text-ink focus:border-accent-blue focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-ink-faint">⌘/Ctrl + Enter to send</span>
            <button
              type="submit"
              disabled={posting || !body.trim()}
              className="cursor-pointer rounded-lg bg-accent-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-blue/85 disabled:opacity-50"
            >
              {posting ? "Posting…" : "Comment"}
            </button>
          </div>
        </form>
    </SlideOver>
  );
}
