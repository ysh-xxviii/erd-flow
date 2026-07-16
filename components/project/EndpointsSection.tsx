"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiRequest, ErdTable, HttpMethod } from "@/lib/types";
import { listRequests, updateRequest } from "@/lib/apiTesting";
import { useProjectStore } from "@/lib/projectStore";
import { usePendingChanges } from "@/lib/pendingChanges";
import {
  autoTitleFromBody,
  defaultWriteup,
  resolveWriteup,
  senseCheckWriteupText,
} from "@/lib/writeup";
import { NotConnectedState } from "./NotConnectedState";
import { Inspector } from "./Inspector";

const METHOD_COLOR: Record<HttpMethod, string> = {
  GET: "#3FB27F",
  POST: "#D9A03F",
  PUT: "#6E9BF5",
  PATCH: "#B48CF2",
  DELETE: "#C25E5E",
};

type EpTab = "writeup" | "payload" | "health" | "runner";

export function EndpointsSection({
  diagramId,
  tables,
}: {
  diagramId: string;
  tables: ErdTable[];
}) {
  const {
    isFullyConnected,
    selectedEndpointId,
    setSelectedEndpointId,
    requestProdGate,
  } = useProjectStore();
  const { addChange, pushToast } = usePendingChanges();
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [tab, setTab] = useState<EpTab>("writeup");
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(await listRequests(diagramId));
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [diagramId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!selectedEndpointId && requests[0]) {
      setSelectedEndpointId(requests[0].id);
    }
  }, [requests, selectedEndpointId, setSelectedEndpointId]);

  const selected = requests.find((r) => r.id === selectedEndpointId) ?? null;
  const tableName = selected?.table_id
    ? tables.find((t) => t.id === selected.table_id)?.name
    : null;

  if (!isFullyConnected) {
    return (
      <div className="flex h-full min-w-0 flex-1">
        <NotConnectedState title="Endpoints locked" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-1">
      <aside className="flex w-[248px] flex-none flex-col border-r border-[#2E333D] bg-[#15181E]">
        <div className="border-b border-[#2E333D] px-3 py-2.5 text-[10px] uppercase tracking-wider text-[#646D7E]">
          Endpoints
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {loading && (
            <p className="px-3 py-2 text-xs text-[#646D7E]">Loading…</p>
          )}
          {!loading && requests.length === 0 && (
            <p className="px-3 py-2 text-xs text-[#646D7E]">
              No endpoints yet. Open API from Schemas or create requests there.
            </p>
          )}
          {requests.map((r) => {
            const active = r.id === selectedEndpointId;
            const tCount = r.table_id ? 1 : 0;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setSelectedEndpointId(r.id);
                  setTab("writeup");
                }}
                className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs ${
                  active
                    ? "bg-[#1A1D23] text-[#E7EAF0]"
                    : "text-[#9AA3B2] hover:bg-[#1A1D23]/60"
                }`}
              >
                <span
                  className="w-10 flex-none font-mono text-[9px] font-bold"
                  style={{ color: METHOD_COLOR[r.method] }}
                >
                  {r.method}
                </span>
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <span className="text-[9px] text-[#646D7E]">{tCount}t</span>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-[#111318]">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center text-sm text-[#646D7E]">
            Select an endpoint
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-[#2E333D] px-4 py-2">
              <span
                className="font-mono text-[10px] font-bold"
                style={{ color: METHOD_COLOR[selected.method] }}
              >
                {selected.method}
              </span>
              <span className="truncate font-mono text-sm text-[#E7EAF0]">
                {selected.url || selected.name}
              </span>
            </div>
            <div className="flex gap-1 border-b border-[#2E333D] px-2">
              {(
                [
                  "writeup",
                  "payload",
                  "health",
                  ...(selected.method === "POST" ||
                  selected.method === "PUT" ||
                  selected.method === "PATCH"
                    ? (["runner"] as const)
                    : (["runner"] as const)),
                ] as EpTab[]
              ).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`cursor-pointer px-3 py-2 text-xs capitalize ${
                    tab === t
                      ? "border-b-2 border-[#6E9BF5] text-[#E7EAF0]"
                      : "text-[#646D7E] hover:text-[#9AA3B2]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {tab === "writeup" && (
                <WriteupEditor
                  request={selected}
                  tableName={tableName}
                  onSaved={reload}
                  onBehaviorChange={(summary) => {
                    addChange({
                      kind: "writeup",
                      summary,
                      label: selected.name,
                      payload: { requestId: selected.id },
                      diffHint: "modified",
                    });
                  }}
                />
              )}
              {tab === "payload" && (
                <PayloadTab
                  request={selected}
                  onToggle={(field) => {
                    addChange({
                      kind: "payload",
                      summary: `Update ${selected.name} payload · ${field}`,
                      label: selected.name,
                      payload: { requestId: selected.id, field },
                      diffHint: "modified",
                    });
                    pushToast("Payload change queued", field);
                  }}
                />
              )}
              {tab === "health" && <HealthTab name={selected.name} />}
              {tab === "runner" && (
                <RunnerTab
                  request={selected}
                  onSend={(fn) => requestProdGate(fn)}
                />
              )}
            </div>
          </>
        )}
      </div>

      <Inspector
        title={selected?.name ?? "Endpoint"}
        breadcrumb="Backend / Endpoints"
      >
        {selected ? (
          <div className="space-y-3 text-xs text-[#9AA3B2]">
            <p>
              <span className="text-[#646D7E]">Method</span>{" "}
              <span style={{ color: METHOD_COLOR[selected.method] }}>
                {selected.method}
              </span>
            </p>
            <p className="break-all font-mono text-[11px] text-[#E7EAF0]">
              {selected.url}
            </p>
            {tableName && (
              <p>
                Touches table{" "}
                <span className="text-[#4EB3A5]">⌗{tableName}</span>
              </p>
            )}
            <p className="text-[10px] text-[#646D7E]">
              Behavior edits to the writeup draft a plan item when saved.
            </p>
          </div>
        ) : (
          <p className="text-xs text-[#646D7E]">Nothing selected</p>
        )}
      </Inspector>
    </div>
  );
}

function ChipText({ text }: { text: string }) {
  const parts = text.split(/(ƒ\w+|⌗[\w.]+|⚠\s*\w+)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("ƒ"))
          return (
            <span
              key={i}
              className="mx-0.5 rounded bg-[#6E9BF5]/15 px-1 font-mono text-[11px] text-[#6E9BF5]"
            >
              {p}
            </span>
          );
        if (p.startsWith("⌗"))
          return (
            <span
              key={i}
              className="mx-0.5 rounded bg-[#4EB3A5]/15 px-1 font-mono text-[11px] text-[#4EB3A5]"
            >
              {p}
            </span>
          );
        if (p.startsWith("⚠"))
          return (
            <span
              key={i}
              className="mx-0.5 rounded bg-[#D9A03F]/15 px-1 font-mono text-[11px] text-[#D9A03F]"
            >
              {p}
            </span>
          );
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

function WriteupEditor({
  request,
  tableName,
  onSaved,
  onBehaviorChange,
}: {
  request: ApiRequest;
  tableName?: string | null;
  onSaved: () => void;
  onBehaviorChange: (summary: string) => void;
}) {
  const resolved = resolveWriteup(request, tableName);
  const [intro, setIntro] = useState(resolved.intro);
  const [steps, setSteps] = useState(resolved.steps);
  const [editId, setEditId] = useState<string | "intro" | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sensing, setSensing] = useState(false);
  const { pushToast } = usePendingChanges();

  useEffect(() => {
    const r = resolveWriteup(request, tableName);
    setIntro(r.intro);
    setSteps(r.steps);
    setEditId(null);
    setError(null);
  }, [request.id, request.writeup_intro, request.writeup_steps, tableName]);

  async function persist(nextIntro: string, nextSteps: typeof steps) {
    await updateRequest(request.id, {
      writeup_intro: nextIntro,
      writeup_steps: nextSteps,
    });
    onSaved();
  }

  async function saveEdit() {
    const check = senseCheckWriteupText(draft);
    if (!check.ok) {
      setError(check.error ?? "Invalid");
      return;
    }
    setSensing(true);
    await new Promise((r) => setTimeout(r, 750));
    setSensing(false);

    if (editId === "intro") {
      setIntro(draft);
      await persist(draft, steps);
    } else if (editId) {
      const next = steps.map((s) =>
        s.id === editId
          ? { ...s, body: draft, title: autoTitleFromBody(draft) }
          : s
      );
      setSteps(next);
      await persist(intro, next);
    }

    if (check.behaviorChange) {
      onBehaviorChange(`Update ${request.method} ${request.name} from writeup`);
      pushToast("Behavior change", "Drafted into unsaved changes.");
    } else {
      pushToast("Wording only", "No behavior change.");
    }
    setEditId(null);
    setError(null);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {sensing && (
        <p className="text-xs text-[#B48CF2]">Making sense of your edit…</p>
      )}
      <div
        className="rounded-md border border-[#2E333D] bg-[#15181E] p-3 text-sm leading-relaxed text-[#9AA3B2]"
        onClick={() => {
          setEditId("intro");
          setDraft(intro);
          setError(null);
        }}
      >
        {editId === "intro" ? (
          <div>
            <textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void saveEdit();
                }
                if (e.key === "Escape") setEditId(null);
              }}
              className="w-full rounded border border-[#6E9BF5]/40 bg-[#111318] p-2 text-sm text-[#E7EAF0]"
              rows={3}
              autoFocus
            />
            {error && <p className="mt-1 text-xs text-[#C25E5E]">{error}</p>}
            <p className="mt-1 text-[10px] text-[#646D7E]">⏎ save · Esc cancel</p>
          </div>
        ) : (
          <ChipText text={intro} />
        )}
      </div>

      <ol className="space-y-3">
        {steps.map((s, idx) => (
          <li
            key={s.id}
            className="group relative rounded-md border border-[#2E333D] bg-[#15181E] p-3"
          >
            <button
              type="button"
              className="absolute right-2 top-2 hidden cursor-pointer text-[#C25E5E] group-hover:block"
              onClick={async (e) => {
                e.stopPropagation();
                const next = steps.filter((x) => x.id !== s.id);
                setSteps(next);
                await persist(intro, next);
                onBehaviorChange(`Remove step from ${request.name}`);
              }}
              aria-label="Delete step"
            >
              ✕
            </button>
            <p className="text-[10px] text-[#646D7E]">Step {idx + 1}</p>
            <p className="text-sm font-semibold text-[#E7EAF0]">{s.title}</p>
            <div
              className="mt-1 cursor-text text-sm text-[#9AA3B2]"
              onClick={() => {
                setEditId(s.id);
                setDraft(s.body);
                setError(null);
              }}
            >
              {editId === s.id ? (
                <div>
                  <textarea
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void saveEdit();
                      }
                      if (e.key === "Escape") setEditId(null);
                    }}
                    className="mt-1 w-full rounded border border-[#6E9BF5]/40 bg-[#111318] p-2 text-sm text-[#E7EAF0]"
                    rows={3}
                    autoFocus
                  />
                  {error && (
                    <p className="mt-1 text-xs text-[#C25E5E]">{error}</p>
                  )}
                </div>
              ) : (
                <ChipText text={s.body} />
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={async () => {
            const next = [
              ...steps,
              {
                id: `step-${Date.now()}`,
                title: "New step",
                body: "Describe the next action with a verb and object.",
              },
            ];
            setSteps(next);
            await persist(intro, next);
          }}
          className="cursor-pointer rounded-md border border-[#2E333D] px-3 py-1.5 text-xs text-[#9AA3B2] hover:text-[#E7EAF0]"
        >
          ＋ Add step
        </button>
        <button
          type="button"
          onClick={async () => {
            const d = defaultWriteup({
              method: request.method,
              name: request.name,
              url: request.url,
              tableName,
            });
            setIntro(d.intro);
            setSteps(d.steps);
            await updateRequest(request.id, {
              writeup_intro: null,
              writeup_steps: [],
            });
            onSaved();
            pushToast("Writeup reset", "Restored generated default.");
          }}
          className="cursor-pointer rounded-md border border-[#2E333D] px-3 py-1.5 text-xs text-[#646D7E] hover:text-[#E7EAF0]"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function PayloadTab({
  request,
  onToggle,
}: {
  request: ApiRequest;
  onToggle: (field: string) => void;
}) {
  const fields = useMemo(() => {
    try {
      const parsed = request.body ? JSON.parse(request.body) : { id: "uuid", status: "string" };
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return Object.keys(parsed as object);
      }
    } catch {
      /* ignore */
    }
    return ["id", "created_at", "status"];
  }, [request.body]);

  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(fields.map((f) => [f, true]))
  );

  return (
    <div className="max-w-md space-y-2">
      <p className="text-xs text-[#9AA3B2]">
        Response field tree. Toggle to draft a payload plan item.
      </p>
      {fields.map((f) => (
        <label
          key={f}
          className="flex cursor-pointer items-center gap-2 rounded border border-[#2E333D] bg-[#15181E] px-3 py-2 text-sm text-[#E7EAF0]"
        >
          <input
            type="checkbox"
            checked={enabled[f] ?? true}
            onChange={() => {
              setEnabled((prev) => ({ ...prev, [f]: !prev[f] }));
              onToggle(f);
            }}
            className="accent-[#6E9BF5]"
          />
          <span className="font-mono text-xs text-[#4EB3A5]">{f}</span>
          <span className="text-[10px] text-[#646D7E]">string</span>
        </label>
      ))}
    </div>
  );
}

function HealthTab({ name }: { name: string }) {
  const points = [12, 18, 14, 22, 30, 16, 11, 28, 20, 15];
  const max = Math.max(...points);
  return (
    <div className="max-w-lg space-y-4">
      <p className="text-xs text-[#9AA3B2]">
        Illustrative latency sample for{" "}
        <span className="text-[#E7EAF0]">{name}</span> (wire real APM later).
      </p>
      <div className="flex h-16 items-end gap-1 rounded-md border border-[#2E333D] bg-[#15181E] p-3">
        {points.map((p, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-[#3FB27F]/70"
            style={{ height: `${(p / max) * 100}%` }}
            title={`${p}ms`}
          />
        ))}
      </div>
      <div>
        <p className="mb-2 text-[10px] uppercase text-[#646D7E]">Recent 5xx</p>
        <ul className="space-y-1 text-xs text-[#9AA3B2]">
          <li className="rounded border border-[#C25E5E]/30 bg-[#C25E5E]/10 px-2 py-1.5">
            502 · upstream timeout · 2m ago
          </li>
          <li className="rounded border border-[#C25E5E]/30 bg-[#C25E5E]/10 px-2 py-1.5">
            500 · null ref in ƒapplyDiscount · 18m ago
          </li>
        </ul>
      </div>
    </div>
  );
}

function RunnerTab({
  request,
  onSend,
}: {
  request: ApiRequest;
  onSend: (fn: () => void) => void;
}) {
  const [body, setBody] = useState(request.body || '{\n  "example": true\n}');
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { pushToast } = usePendingChanges();

  async function send() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/http/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: request.method,
          url: request.url,
          headers: request.headers,
          body: request.body_type === "none" ? undefined : body,
        }),
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (e) {
      pushToast("Send failed", e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <p className="text-xs text-[#9AA3B2]">
        {request.name}. Env-aware send via server proxy. Prod is gated.
      </p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={8}
        className="w-full rounded-md border border-[#2E333D] bg-[#15181E] p-3 font-mono text-xs text-[#E7EAF0]"
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => onSend(() => void send())}
        className="cursor-pointer rounded-md bg-[#6E9BF5] px-3 py-1.5 text-sm font-semibold text-[#111318] disabled:opacity-50"
      >
        {busy ? "Sending…" : "Send"}
      </button>
      {result && (
        <pre className="max-h-64 overflow-auto rounded-md border border-[#2E333D] bg-[#111318] p-3 font-mono text-[11px] text-[#9AA3B2]">
          {result}
        </pre>
      )}
    </div>
  );
}

/** Shell typing helper */
export type EndpointsSectionProps = {
  diagramId: string;
  tables: ErdTable[];
};
