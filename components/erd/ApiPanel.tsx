"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ApiCollection,
  ApiEnvironment,
  ApiHeader,
  ApiRequest,
  ApiResponseResult,
  ErdRelationship,
  ErdTable,
  HttpMethod,
  SuggestedEndpoint,
} from "@/lib/types";
import {
  applyEndpointSuggestions,
  createCollection,
  createEnvironment,
  createRequest,
  deleteRequest,
  generateCrudRequests,
  listCollections,
  listEnvironments,
  listRequests,
  resolvePathParams,
  resolveVariables,
  updateEnvironment,
  updateRequest,
} from "@/lib/apiTesting";
import { buildSchemaSnapshot } from "@/lib/schemaSnapshot";
import { SlideOver } from "./SlideOver";

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const METHOD_COLOR: Record<HttpMethod, string> = {
  GET: "#1bb38c",
  POST: "#e3b341",
  PUT: "#5aa6ff",
  PATCH: "#8b7bff",
  DELETE: "#e7536a",
};

export function ApiPanel({
  diagramId,
  tables,
  relationships,
  selectedTableId,
  focusTableId,
  focusEndpointIds,
  focusLabel,
  onClearFocus,
  onRequestsChanged,
  onClose,
}: {
  diagramId: string;
  tables: ErdTable[];
  relationships?: ErdRelationship[];
  selectedTableId: string | null;
  focusTableId?: string | null;
  focusEndpointIds?: string[] | null;
  focusLabel?: string | null;
  onClearFocus?: () => void;
  onRequestsChanged?: () => void;
  onClose: () => void;
}) {
  const [environments, setEnvironments] = useState<ApiEnvironment[]>([]);
  const [collections, setCollections] = useState<ApiCollection[]>([]);
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const requestsRef = useRef<ApiRequest[]>([]);
  requestsRef.current = requests;
  const [envId, setEnvId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<ApiRequest | null>(null);
  const [bodyTab, setBodyTab] = useState<"headers" | "body">("headers");
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<ApiResponseResult | null>(null);
  const [genTableId, setGenTableId] = useState<string>(selectedTableId ?? "");
  const [generating, setGenerating] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [createMode, setCreateMode] = useState<"ai" | "manual">("ai");
  const [aiDescription, setAiDescription] = useState("");

  const focusTable = useMemo(
    () => (focusTableId ? tables.find((t) => t.id === focusTableId) ?? null : null),
    [focusTableId, tables]
  );

  const focusEndpointIdSet = useMemo(
    () => (focusEndpointIds?.length ? new Set(focusEndpointIds) : null),
    [focusEndpointIds]
  );

  useEffect(() => {
    if (focusTableId) setGenTableId(focusTableId);
  }, [focusTableId]);

  useEffect(() => {
    if (!focusTableId || loading) return;
    const first = requestsRef.current.find((r) => r.table_id === focusTableId);
    if (first) setActiveId(first.id);
  }, [focusTableId, loading]);

  useEffect(() => {
    if (!focusEndpointIds?.length || loading) return;
    const first = requestsRef.current.find((r) =>
      focusEndpointIds.includes(r.id)
    );
    if (first) setActiveId(first.id);
  }, [focusEndpointIds, loading]);

  const tableHasRequests = useMemo(
    () =>
      genTableId
        ? requests.some((r) => r.table_id === genTableId)
        : false,
    [requests, genTableId]
  );

  const activeEnv = useMemo(
    () => environments.find((e) => e.id === envId) ?? null,
    [environments, envId]
  );

  const reload = useCallback(async () => {
    try {
      const [envs, cols, reqs] = await Promise.all([
        listEnvironments(diagramId),
        listCollections(diagramId),
        listRequests(diagramId),
      ]);
      setEnvironments(envs);
      setCollections(cols);
      setRequests(reqs);
      setEnvId((prev) => prev ?? envs.find((e) => e.is_default)?.id ?? envs[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load API workspace");
    } finally {
      setLoading(false);
    }
  }, [diagramId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Load the selected request into the editable draft. Depends only on the
  // active id (reads requests via ref) so autosave-driven `requests` updates
  // don't reset the draft or wipe the visible response.
  useEffect(() => {
    const req = requestsRef.current.find((r) => r.id === activeId) ?? null;
    setDraft(req ? { ...req } : null);
    setResponse(null);
  }, [activeId]);

  // Debounced autosave of the draft request. Skips when the draft matches the
  // stored request to avoid a save/reload churn loop.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!draft) return;
    const stored = requestsRef.current.find((r) => r.id === draft.id);
    if (stored && !requestChanged(stored, draft)) return;

    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void updateRequest(draft.id, {
        name: draft.name,
        method: draft.method,
        url: draft.url,
        headers: draft.headers,
        body: draft.body,
        body_type: draft.body_type,
      })
        .then(() =>
          setRequests((prev) => prev.map((r) => (r.id === draft.id ? draft : r)))
        )
        .catch((e) =>
          setError(e instanceof Error ? e.message : "Could not save request")
        );
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [draft]);

  const patchDraft = useCallback((patch: Partial<ApiRequest>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }, []);

  async function ensureCollection(): Promise<string> {
    if (collections[0]) return collections[0].id;
    const col = await createCollection({ diagramId, name: "My requests" });
    setCollections((prev) => [...prev, col]);
    return col.id;
  }

  async function addManualRequest() {
    setError(null);
    const table =
      tables.find((t) => t.id === genTableId) ?? focusTable ?? null;
    try {
      const collectionId = await ensureCollection();
      const req = await createRequest({
        diagramId,
        collection_id: collectionId,
        table_id: table?.id ?? null,
        name: table ? `New ${table.name} request` : "New request",
        method: "GET",
        url: table ? `{{baseUrl}}/${table.name}` : "{{baseUrl}}/",
        sort_order: requests.length,
      });
      setRequests((prev) => [...prev, req]);
      setActiveId(req.id);
      setCreateMode("manual");
      onRequestsChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create request");
    }
  }

  async function addBlankRequest() {
    await addManualRequest();
  }

  async function addCollection() {
    setError(null);
    try {
      const col = await createCollection({
        diagramId,
        name: `Collection ${collections.length + 1}`,
        sortOrder: collections.length,
      });
      setCollections((prev) => [...prev, col]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create collection");
    }
  }

  async function generateForTable() {
    const table = tables.find((t) => t.id === genTableId);
    if (!table) return;

    const existing = requests.filter((r) => r.table_id === table.id);
    if (existing.length > 0) {
      setError(
        `Requests for "${table.name}" already exist. Delete them in the sidebar before regenerating.`
      );
      return;
    }

    setError(null);
    setGenerating(true);
    try {
      const collectionId = await ensureCollection();
      const specs = generateCrudRequests(table);
      const created: ApiRequest[] = [];
      for (let i = 0; i < specs.length; i++) {
        const s = specs[i];
        const req = await createRequest({
          diagramId,
          collection_id: collectionId,
          table_id: table.id,
          name: s.name,
          method: s.method,
          url: s.url,
          headers: s.headers,
          body: s.body,
          body_type: s.body_type,
          sort_order: requests.length + i,
        });
        created.push(req);
      }
      setRequests((prev) => [...prev, ...created]);
      if (created[0]) setActiveId(created[0].id);
      onRequestsChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate requests");
    } finally {
      setGenerating(false);
    }
  }

  async function generateWithAi() {
    if (tables.length === 0) return;

    if (genTableId && tableHasRequests) {
      const table = tables.find((t) => t.id === genTableId);
      setError(
        `Requests for "${table?.name ?? "this table"}" already exist. Delete them before generating again.`
      );
      return;
    }

    setError(null);
    setGeneratingAi(true);
    try {
      const res = await fetch("/api/ai/suggest-endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schema: buildSchemaSnapshot(tables, relationships ?? []),
          description: aiDescription.trim(),
        }),
      });
      const data = (await res.json()) as {
        endpoints?: SuggestedEndpoint[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "AI request failed");
      }

      let endpoints = data.endpoints ?? [];
      if (genTableId) {
        const table = tables.find((t) => t.id === genTableId);
        if (table) {
          endpoints = endpoints.filter(
            (e) => e.table?.toLowerCase() === table.name.toLowerCase()
          );
        }
      }

      if (endpoints.length === 0) {
        throw new Error("AI returned no endpoints for the selected scope.");
      }

      const skipTableIds = new Set(
        requests
          .map((r) => r.table_id)
          .filter((id): id is string => !!id)
      );

      const tableIdByName: Record<string, string> = {};
      for (const t of tables) {
        tableIdByName[t.name.toLowerCase()] = t.id;
      }

      const collectionId = await ensureCollection();
      const created = await applyEndpointSuggestions(
        diagramId,
        collectionId,
        endpoints,
        tableIdByName,
        { skipTableIds, startSortOrder: requests.length }
      );

      if (created.length === 0) {
        throw new Error(
          "No new endpoints were added — tables may already have requests."
        );
      }

      setRequests((prev) => [...prev, ...created]);
      if (created[0]) setActiveId(created[0].id);
      onRequestsChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate endpoints");
    } finally {
      setGeneratingAi(false);
    }
  }

  async function removeRequest(id: string) {
    setError(null);
    const prev = requests;
    setRequests((rs) => rs.filter((r) => r.id !== id));
    if (activeId === id) setActiveId(null);
    try {
      await deleteRequest(id);
      onRequestsChanged?.();
    } catch (e) {
      setRequests(prev);
      setError(e instanceof Error ? e.message : "Could not delete request");
    }
  }

  async function ensureEnv() {
    if (activeEnv) return;
    setError(null);
    try {
      const env = await createEnvironment({
        diagramId,
        name: "Default",
        variables: { baseUrl: "https://jsonplaceholder.typicode.com", id: "1" },
        isDefault: true,
      });
      setEnvironments((prev) => [...prev, env]);
      setEnvId(env.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create environment");
    }
  }

  function setEnvVar(key: string, value: string) {
    if (!activeEnv) return;
    const variables = { ...activeEnv.variables, [key]: value };
    setEnvironments((prev) =>
      prev.map((e) => (e.id === activeEnv.id ? { ...e, variables } : e))
    );
  }

  function renameEnvVar(oldKey: string, newKey: string) {
    if (!activeEnv || oldKey === newKey) return;
    const variables: Record<string, string> = {};
    for (const [k, v] of Object.entries(activeEnv.variables)) {
      variables[k === oldKey ? newKey : k] = v;
    }
    setEnvironments((prev) =>
      prev.map((e) => (e.id === activeEnv.id ? { ...e, variables } : e))
    );
  }

  function removeEnvVar(key: string) {
    if (!activeEnv) return;
    const variables = { ...activeEnv.variables };
    delete variables[key];
    setEnvironments((prev) =>
      prev.map((e) => (e.id === activeEnv.id ? { ...e, variables } : e))
    );
    void updateEnvironment(activeEnv.id, { variables });
  }

  function persistEnv() {
    if (activeEnv) void updateEnvironment(activeEnv.id, { variables: activeEnv.variables });
  }

  async function send() {
    if (!draft) return;
    setSending(true);
    setResponse(null);
    setError(null);
    const vars = activeEnv?.variables ?? {};

    const urlResolved = resolveVariables(draft.url, vars);
    if (urlResolved.missing.length > 0) {
      setError(
        `Set environment variable${urlResolved.missing.length > 1 ? "s" : ""}: ${urlResolved.missing.join(", ")} (e.g. baseUrl = https://jsonplaceholder.typicode.com)`
      );
      setSending(false);
      return;
    }
    const finalUrl = resolvePathParams(urlResolved.resolved, vars);

    try {
      const res = await fetch("/api/http/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagramId,
          method: draft.method,
          url: finalUrl,
          headers: draft.headers.map((h) => {
            const v = resolveVariables(h.value, vars);
            return { key: h.key, value: v.resolved };
          }),
          body:
            draft.body_type === "json"
              ? resolveVariables(draft.body, vars).resolved
              : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Request failed");
      } else {
        setResponse(json as ApiResponseResult);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSending(false);
    }
  }

  const requestsByCollection = useCallback(
    (collectionId: string) => {
      let list = requests.filter((r) => r.collection_id === collectionId);
      if (focusEndpointIdSet) {
        list = list.filter((r) => focusEndpointIdSet.has(r.id));
      } else if (focusTableId) {
        list = list.filter((r) => r.table_id === focusTableId);
      }
      return list;
    },
    [requests, focusTableId, focusEndpointIdSet]
  );

  const visibleRequestCount = useMemo(() => {
    if (focusEndpointIdSet) {
      return requests.filter((r) => focusEndpointIdSet.has(r.id)).length;
    }
    if (focusTableId) {
      return requests.filter((r) => r.table_id === focusTableId).length;
    }
    return requests.length;
  }, [requests, focusTableId, focusEndpointIdSet]);

  const isGenerating = generating || generatingAi;

  return (
    <SlideOver
      onClose={onClose}
      asideClassName="relative flex h-full w-full max-w-4xl flex-col border-l border-border-subtle bg-surface shadow-2xl"
    >
        <header className="flex items-center justify-between border-b border-border-subtle p-4">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1bb38c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h10" />
            </svg>
            <h2 className="text-base font-semibold text-ink">API Testing</h2>
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
        </header>

        {error && (
          <p
            role="alert"
            className="mx-4 mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          >
            {error}
          </p>
        )}

        <div className="flex min-h-0 flex-1">
          {/* Sidebar */}
          <div className="flex w-64 flex-none flex-col gap-3 overflow-y-auto border-r border-border-subtle p-3">
            {/* Environment */}
            <section>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-ink-faint">
                  Environment
                </span>
                {!activeEnv && (
                  <button
                    type="button"
                    onClick={ensureEnv}
                    className="cursor-pointer text-[11px] text-accent-green hover:underline"
                  >
                    + Create
                  </button>
                )}
              </div>
              {environments.length > 0 && (
                <select
                  value={envId ?? ""}
                  onChange={(e) => setEnvId(e.target.value)}
                  className="mb-2 w-full rounded-md border border-border-subtle bg-canvas px-2 py-1.5 text-xs text-ink focus:border-accent-blue focus:outline-none"
                >
                  {environments.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              )}
              {activeEnv && (
                <div className="space-y-1">
                  {Object.keys(activeEnv.variables).length === 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setEnvVar("baseUrl", "https://jsonplaceholder.typicode.com");
                        setEnvVar("id", "1");
                        persistEnv();
                      }}
                      className="mb-1 cursor-pointer text-[11px] text-accent-green hover:underline"
                    >
                      + Add baseUrl
                    </button>
                  )}
                  {Object.entries(activeEnv.variables).map(([varKey, value]) => (
                    <div key={`${activeEnv.id}-${varKey}`} className="flex items-center gap-1">
                      <input
                        defaultValue={varKey}
                        onBlur={(e) => {
                          renameEnvVar(varKey, e.target.value.trim());
                          persistEnv();
                        }}
                        className="w-1/2 rounded border border-border-subtle bg-canvas px-1.5 py-1 font-mono text-[11px] text-ink focus:border-accent-blue focus:outline-none"
                      />
                      <input
                        value={value}
                        onChange={(e) => setEnvVar(varKey, e.target.value)}
                        onBlur={persistEnv}
                        placeholder={varKey === "baseUrl" ? "https://…" : ""}
                        className="w-1/2 rounded border border-border-subtle bg-canvas px-1.5 py-1 font-mono text-[11px] text-ink focus:border-accent-blue focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeEnvVar(varKey)}
                        aria-label={`Remove ${varKey}`}
                        className="cursor-pointer px-1 text-ink-faint hover:text-red-300"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      let i = 1;
                      let name = "var";
                      while (name in activeEnv.variables) name = `var${i++}`;
                      setEnvVar(name, "");
                      persistEnv();
                    }}
                    className="cursor-pointer text-[11px] text-accent-blue hover:underline"
                  >
                    + Add variable
                  </button>
                </div>
              )}
            </section>

            {/* Create API */}
            <section className="rounded-lg border border-border-subtle bg-canvas/40 p-2">
              <span className="mb-2 block text-[10px] uppercase tracking-wide text-ink-faint">
                Create API
              </span>

              {focusLabel && (
                <div className="mb-2 flex items-center gap-1 rounded-md border border-accent-blue/30 bg-accent-blue/10 px-2 py-1">
                  <span className="min-w-0 flex-1 truncate text-[10px] text-accent-blue">
                    Path: {focusLabel}
                  </span>
                  {onClearFocus && (
                    <button
                      type="button"
                      onClick={onClearFocus}
                      aria-label="Clear path filter"
                      className="cursor-pointer flex-none text-[10px] text-ink-faint hover:text-ink"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}

              {focusTable && !focusLabel && (
                <div className="mb-2 flex items-center gap-1 rounded-md border border-accent-green/30 bg-accent-green/10 px-2 py-1">
                  <span className="min-w-0 flex-1 truncate text-[10px] text-accent-green">
                    Table: {focusTable.name}
                  </span>
                  {onClearFocus && (
                    <button
                      type="button"
                      onClick={onClearFocus}
                      aria-label="Clear table filter"
                      className="cursor-pointer flex-none text-[10px] text-ink-faint hover:text-ink"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}

              <div className="mb-2 flex rounded-md border border-border-subtle bg-canvas p-0.5">
                <button
                  type="button"
                  onClick={() => setCreateMode("ai")}
                  className={`flex-1 cursor-pointer rounded px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                    createMode === "ai"
                      ? "bg-accent-blue/20 text-accent-blue"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  With AI
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode("manual")}
                  className={`flex-1 cursor-pointer rounded px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                    createMode === "manual"
                      ? "bg-accent-green/20 text-accent-green"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  Manual
                </button>
              </div>

              <select
                value={genTableId}
                onChange={(e) => setGenTableId(e.target.value)}
                className="mb-2 w-full rounded-md border border-border-subtle bg-canvas px-2 py-1.5 text-xs text-ink focus:border-accent-blue focus:outline-none"
              >
                <option value="">All tables…</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              {createMode === "ai" ? (
                <div className="space-y-2">
                  <textarea
                    value={aiDescription}
                    onChange={(e) => setAiDescription(e.target.value)}
                    rows={3}
                    placeholder="Optional: e.g. add auth login, nested user posts, pagination…"
                    className="w-full resize-none rounded-md border border-border-subtle bg-canvas px-2 py-1.5 text-[11px] text-ink placeholder:text-ink-faint focus:border-accent-blue focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void generateWithAi()}
                    disabled={
                      isGenerating || tables.length === 0 || (genTableId ? tableHasRequests : false)
                    }
                    className="w-full cursor-pointer rounded-md bg-accent-blue/15 px-2 py-2 text-[11px] font-semibold text-accent-blue transition-colors hover:bg-accent-blue/25 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {generatingAi ? "Creating with AI…" : "Create with AI"}
                  </button>
                  <p className="text-[10px] leading-relaxed text-ink-faint">
                    AI reads your schema and generates REST endpoints linked to tables.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => void addManualRequest()}
                    disabled={isGenerating}
                    className="w-full cursor-pointer rounded-md border border-border-subtle bg-canvas px-2 py-2 text-[11px] font-semibold text-ink transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Blank request
                  </button>
                  <button
                    type="button"
                    onClick={generateForTable}
                    disabled={!genTableId || tableHasRequests || isGenerating}
                    className="w-full cursor-pointer rounded-md bg-accent-green/15 px-2 py-2 text-[11px] font-semibold text-accent-green transition-colors hover:bg-accent-green/25 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {generating
                      ? "Creating…"
                      : tableHasRequests
                        ? "CRUD already exists"
                        : "Standard CRUD (5 requests)"}
                  </button>
                  <p className="text-[10px] leading-relaxed text-ink-faint">
                    Build your own request or scaffold list/get/create/update/delete for one table.
                  </p>
                </div>
              )}

              {genTableId && tableHasRequests && createMode === "ai" && (
                <p className="mt-2 text-[10px] text-ink-faint">
                  Delete existing requests for this table to regenerate.
                </p>
              )}
            </section>

            {/* Collections + requests */}
            <section className="min-h-0 flex-1">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-ink-faint">
                  Requests
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addCollection}
                    className="cursor-pointer text-[11px] text-ink-muted hover:text-ink"
                  >
                    + Folder
                  </button>
                  <button
                    type="button"
                    onClick={addBlankRequest}
                    className="cursor-pointer text-[11px] text-accent-blue hover:underline"
                  >
                    + Request
                  </button>
                </div>
              </div>

              {loading ? (
                <p className="text-xs text-ink-faint">Loading…</p>
              ) : visibleRequestCount === 0 ? (
                <p className="text-xs text-ink-faint">
                  {focusLabel
                    ? `No endpoints on path ${focusLabel}.`
                    : focusTable
                      ? `No API for ${focusTable.name} yet. Use Create API above.`
                      : "No requests yet. Use Create API above."}
                </p>
              ) : (
                <div className="space-y-2">
                  {collections.map((col) => (
                    <div key={col.id}>
                      <p className="mb-1 truncate text-[11px] font-semibold text-ink-muted">
                        {col.name}
                      </p>
                      <ul className="space-y-0.5">
                        {requestsByCollection(col.id).map((r) => (
                          <li key={r.id}>
                            <button
                              type="button"
                              onClick={() => setActiveId(r.id)}
                              className={`group flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors ${
                                activeId === r.id
                                  ? "bg-accent-blue/15 text-ink"
                                  : "text-ink-muted hover:bg-card"
                              }`}
                            >
                              <span
                                className="flex-none font-mono text-[9px] font-bold"
                                style={{ color: METHOD_COLOR[r.method] }}
                              >
                                {r.method}
                              </span>
                              <span className="min-w-0 flex-1 truncate">{r.name}</span>
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void removeRequest(r.id);
                                }}
                                className="hidden flex-none cursor-pointer px-1 text-ink-faint hover:text-red-300 group-hover:inline"
                              >
                                ×
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Main editor */}
          <div className="flex min-w-0 flex-1 flex-col">
            {!draft ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8">
                <div className="text-center">
                  <h3 className="text-base font-semibold text-ink">Create your API</h3>
                  <p className="mt-1 max-w-sm text-sm text-ink-muted">
                    Generate endpoints from your schema with AI, or build requests manually.
                  </p>
                </div>
                <div className="grid w-full max-w-md grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateMode("ai");
                      void generateWithAi();
                    }}
                    disabled={isGenerating || tables.length === 0}
                    className="cursor-pointer rounded-xl border border-accent-blue/30 bg-accent-blue/10 p-4 text-left transition-colors hover:bg-accent-blue/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent-blue/20 text-accent-blue">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
                        <path d="M5 19l1 3 1-3 3-1-3-1-1-3-1 3-3 1z" />
                      </svg>
                    </span>
                    <span className="block text-sm font-semibold text-ink">With AI</span>
                    <span className="mt-1 block text-xs text-ink-muted">
                      Smart REST endpoints from your ERD
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateMode("manual");
                      void addManualRequest();
                    }}
                    disabled={isGenerating}
                    className="cursor-pointer rounded-xl border border-accent-green/30 bg-accent-green/10 p-4 text-left transition-colors hover:bg-accent-green/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent-green/20 text-accent-green">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                    <span className="block text-sm font-semibold text-ink">Manual</span>
                    <span className="mt-1 block text-xs text-ink-muted">
                      Blank request or standard CRUD
                    </span>
                  </button>
                </div>
                <p className="text-xs text-ink-faint">
                  Or pick a table and mode in the sidebar.
                </p>
              </div>
            ) : (
              <>
                <div className="border-b border-border-subtle p-3">
                  <input
                    value={draft.name}
                    onChange={(e) => patchDraft({ name: e.target.value })}
                    className="mb-2 w-full bg-transparent text-sm font-semibold text-ink focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <select
                      value={draft.method}
                      onChange={(e) =>
                        patchDraft({ method: e.target.value as HttpMethod })
                      }
                      className="flex-none rounded-md border border-border-subtle bg-canvas px-2 py-2 font-mono text-xs font-bold focus:border-accent-blue focus:outline-none"
                      style={{ color: METHOD_COLOR[draft.method] }}
                    >
                      {METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <input
                      value={draft.url}
                      onChange={(e) => patchDraft({ url: e.target.value })}
                      placeholder="{{baseUrl}}/path"
                      className="min-w-0 flex-1 rounded-md border border-border-subtle bg-canvas px-2 py-2 font-mono text-xs text-ink placeholder:text-ink-faint focus:border-accent-blue focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={send}
                      disabled={sending}
                      className="flex-none cursor-pointer rounded-md bg-accent-blue px-4 py-2 text-xs font-semibold text-canvas transition-colors hover:bg-[#79b6ff] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {sending ? "Sending…" : "Send"}
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 border-b border-border-subtle px-3 pt-2">
                  <TabButton
                    active={bodyTab === "headers"}
                    onClick={() => setBodyTab("headers")}
                  >
                    Headers ({draft.headers.length})
                  </TabButton>
                  <TabButton
                    active={bodyTab === "body"}
                    onClick={() => setBodyTab("body")}
                  >
                    Body
                  </TabButton>
                </div>

                <div className="max-h-[34vh] overflow-y-auto p-3">
                  {bodyTab === "headers" ? (
                    <HeadersEditor
                      headers={draft.headers}
                      onChange={(headers) => patchDraft({ headers })}
                    />
                  ) : (
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <label className="flex items-center gap-1 text-[11px] text-ink-muted">
                          <input
                            type="radio"
                            checked={draft.body_type === "none"}
                            onChange={() => patchDraft({ body_type: "none" })}
                          />
                          none
                        </label>
                        <label className="flex items-center gap-1 text-[11px] text-ink-muted">
                          <input
                            type="radio"
                            checked={draft.body_type === "json"}
                            onChange={() => patchDraft({ body_type: "json" })}
                          />
                          JSON
                        </label>
                        {draft.body_type === "json" && (
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                patchDraft({
                                  body: JSON.stringify(
                                    JSON.parse(draft.body),
                                    null,
                                    2
                                  ),
                                });
                              } catch {
                                setError("Body is not valid JSON");
                              }
                            }}
                            className="ml-auto cursor-pointer text-[11px] text-accent-blue hover:underline"
                          >
                            Format
                          </button>
                        )}
                      </div>
                      {draft.body_type === "json" && (
                        <textarea
                          value={draft.body}
                          onChange={(e) => patchDraft({ body: e.target.value })}
                          rows={8}
                          spellCheck={false}
                          className="w-full rounded-md border border-border-subtle bg-canvas p-2 font-mono text-[11px] leading-relaxed text-ink focus:border-accent-blue focus:outline-none"
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Response */}
                <div className="min-h-0 flex-1 overflow-y-auto border-t border-border-subtle p-3">
                  {response ? (
                    <>
                      <div className="mb-2 flex items-center gap-3 text-xs">
                        <span
                          className="rounded px-2 py-0.5 font-mono font-bold"
                          style={{
                            color:
                              response.status < 400 ? "#1bb38c" : "#e7536a",
                            background:
                              response.status < 400
                                ? "rgba(27,179,140,0.15)"
                                : "rgba(231,83,106,0.15)",
                          }}
                        >
                          {response.status} {response.statusText}
                        </span>
                        <span className="text-ink-faint">
                          {response.durationMs} ms
                        </span>
                      </div>
                      <pre className="overflow-auto rounded-lg border border-border-subtle bg-canvas p-3 font-mono text-[11px] leading-relaxed text-ink">
                        {formatBody(response.body)}
                      </pre>
                    </>
                  ) : (
                    <p className="text-xs text-ink-faint">
                      Send the request to see the response here.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
    </SlideOver>
  );
}

function formatBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

/** True when any savable field of the draft differs from the stored request. */
function requestChanged(a: ApiRequest, b: ApiRequest): boolean {
  return (
    a.name !== b.name ||
    a.method !== b.method ||
    a.url !== b.url ||
    a.body !== b.body ||
    a.body_type !== b.body_type ||
    JSON.stringify(a.headers) !== JSON.stringify(b.headers)
  );
}

function HeadersEditor({
  headers,
  onChange,
}: {
  headers: ApiHeader[];
  onChange: (headers: ApiHeader[]) => void;
}) {
  return (
    <div className="space-y-1">
      {headers.map((h, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            value={h.key}
            onChange={(e) =>
              onChange(
                headers.map((x, j) => (j === i ? { ...x, key: e.target.value } : x))
              )
            }
            placeholder="Header"
            className="w-1/2 rounded border border-border-subtle bg-canvas px-1.5 py-1 font-mono text-[11px] text-ink placeholder:text-ink-faint focus:border-accent-blue focus:outline-none"
          />
          <input
            value={h.value}
            onChange={(e) =>
              onChange(
                headers.map((x, j) => (j === i ? { ...x, value: e.target.value } : x))
              )
            }
            placeholder="Value"
            className="w-1/2 rounded border border-border-subtle bg-canvas px-1.5 py-1 font-mono text-[11px] text-ink placeholder:text-ink-faint focus:border-accent-blue focus:outline-none"
          />
          <button
            type="button"
            onClick={() => onChange(headers.filter((_, j) => j !== i))}
            aria-label="Remove header"
            className="cursor-pointer px-1 text-ink-faint hover:text-red-300"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...headers, { key: "", value: "" }])}
        className="cursor-pointer text-[11px] text-accent-blue hover:underline"
      >
        + Add header
      </button>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-card text-ink"
          : "text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
