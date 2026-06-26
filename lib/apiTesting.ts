"use client";

// Client-side data access for the per-diagram API testing workspace.
// Uses the authenticated Supabase browser client; RLS enforces access.

import { createClient } from "@/lib/supabase/client";
import type {
  ApiCollection,
  ApiEnvironment,
  ApiHeader,
  ApiRequest,
  ErdColumn,
  ErdTable,
  HttpMethod,
  RequestBodyType,
  SuggestedEndpoint,
} from "@/lib/types";

function normalizeEnvironment(row: Record<string, unknown>): ApiEnvironment {
  return {
    id: row.id as string,
    diagram_id: row.diagram_id as string,
    name: row.name as string,
    variables: (row.variables as Record<string, string> | null) ?? {},
    is_default: !!row.is_default,
    created_by: (row.created_by as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

function normalizeRequest(row: Record<string, unknown>): ApiRequest {
  return {
    id: row.id as string,
    diagram_id: row.diagram_id as string,
    collection_id: (row.collection_id as string | null) ?? null,
    table_id: (row.table_id as string | null) ?? null,
    name: row.name as string,
    method: row.method as HttpMethod,
    url: row.url as string,
    headers: (row.headers as ApiHeader[] | null) ?? [],
    body: (row.body as string | null) ?? "",
    body_type: (row.body_type as RequestBodyType | null) ?? "none",
    sort_order: (row.sort_order as number | null) ?? 0,
    created_by: (row.created_by as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

// ---------------------------------------------------------------------
// Environments
// ---------------------------------------------------------------------

export async function listEnvironments(
  diagramId: string
): Promise<ApiEnvironment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("diagram_api_environments")
    .select("*")
    .eq("diagram_id", diagramId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalizeEnvironment);
}

export async function createEnvironment(input: {
  diagramId: string;
  name: string;
  variables?: Record<string, string>;
  isDefault?: boolean;
}): Promise<ApiEnvironment> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("diagram_api_environments")
    .insert({
      diagram_id: input.diagramId,
      name: input.name,
      variables: input.variables ?? {},
      is_default: input.isDefault ?? false,
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return normalizeEnvironment(data);
}

export async function updateEnvironment(
  id: string,
  patch: { name?: string; variables?: Record<string, string> }
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("diagram_api_environments")
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteEnvironment(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("diagram_api_environments")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------

export async function listCollections(
  diagramId: string
): Promise<ApiCollection[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("diagram_api_collections")
    .select("*")
    .eq("diagram_id", diagramId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ApiCollection[];
}

export async function createCollection(input: {
  diagramId: string;
  name: string;
  sortOrder?: number;
}): Promise<ApiCollection> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("diagram_api_collections")
    .insert({
      diagram_id: input.diagramId,
      name: input.name,
      sort_order: input.sortOrder ?? 0,
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ApiCollection;
}

export async function renameCollection(id: string, name: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("diagram_api_collections")
    .update({ name })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteCollection(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("diagram_api_collections")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------

export async function listRequests(diagramId: string): Promise<ApiRequest[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("diagram_api_requests")
    .select("*")
    .eq("diagram_id", diagramId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalizeRequest);
}

export async function createRequest(
  input: Partial<Omit<ApiRequest, "id" | "created_at" | "created_by">> & {
    diagramId: string;
  }
): Promise<ApiRequest> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("diagram_api_requests")
    .insert({
      diagram_id: input.diagramId,
      collection_id: input.collection_id ?? null,
      table_id: input.table_id ?? null,
      name: input.name ?? "New request",
      method: input.method ?? "GET",
      url: input.url ?? "",
      headers: input.headers ?? [],
      body: input.body ?? "",
      body_type: input.body_type ?? "none",
      sort_order: input.sort_order ?? 0,
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return normalizeRequest(data);
}

export async function updateRequest(
  id: string,
  patch: Partial<
    Pick<
      ApiRequest,
      | "name"
      | "method"
      | "url"
      | "headers"
      | "body"
      | "body_type"
      | "collection_id"
      | "sort_order"
    >
  >
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("diagram_api_requests")
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteRequest(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("diagram_api_requests")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------
// Variable substitution
// ---------------------------------------------------------------------

/** Replace {{var}} tokens in a template with values from the environment. */
export function substituteVariables(
  template: string,
  vars: Record<string, string>
): string {
  return resolveVariables(template, vars).resolved;
}

/** Substitute variables and report any missing or empty bindings. */
export function resolveVariables(
  template: string,
  vars: Record<string, string>
): { resolved: string; missing: string[] } {
  const missing: string[] = [];
  const resolved = template.replace(
    /\{\{\s*([\w.-]+)\s*\}\}/g,
    (match, key: string) => {
      const val = vars[key]?.trim();
      if (!val) {
        missing.push(key);
        return match;
      }
      return val;
    }
  );
  return { resolved, missing: [...new Set(missing)] };
}

/** Replace :pathParams using env vars (e.g. id → {{id}} or default 1 for :id). */
export function resolvePathParams(
  url: string,
  vars: Record<string, string>
): string {
  return url.replace(/:([\w]+)/g, (_, name: string) => {
    const val = vars[name]?.trim();
    if (val) return val;
    if (name === "id") return "1";
    return `:${name}`;
  });
}

// ---------------------------------------------------------------------
// Schema-aware CRUD request generation
// ---------------------------------------------------------------------

function sampleValue(col: ErdColumn): unknown {
  const type = col.data_type.toLowerCase();
  const name = col.name.toLowerCase();
  if (type.includes("bool")) return true;
  if (
    type.includes("int") ||
    type.includes("numeric") ||
    type.includes("decimal") ||
    type.includes("float") ||
    type.includes("double")
  ) {
    return 0;
  }
  if (type.includes("json")) return {};
  if (type.includes("uuid")) return "00000000-0000-0000-0000-000000000000";
  if (type.includes("timestamp") || type.includes("date")) {
    return new Date().toISOString();
  }
  if (name.includes("email")) return "user@example.com";
  return `sample ${col.name}`;
}

/** Build a JSON body string from a table's non-PK columns. */
export function sampleBodyForTable(table: ErdTable): string {
  const body: Record<string, unknown> = {};
  for (const col of table.columns) {
    if (col.is_pk) continue;
    body[col.name] = sampleValue(col);
  }
  return JSON.stringify(body, null, 2);
}

const JSON_HEADER: ApiHeader[] = [
  { key: "Content-Type", value: "application/json" },
];

/** A starter CRUD request set for a table, ready to persist. */
export interface GeneratedRequest {
  name: string;
  method: HttpMethod;
  url: string;
  headers: ApiHeader[];
  body: string;
  body_type: RequestBodyType;
}

export function generateCrudRequests(table: ErdTable): GeneratedRequest[] {
  const path = `{{baseUrl}}/${table.name}`;
  const sampleBody = sampleBodyForTable(table);
  return [
    {
      name: `List ${table.name}`,
      method: "GET",
      url: path,
      headers: [],
      body: "",
      body_type: "none",
    },
    {
      name: `Get ${table.name} by id`,
      method: "GET",
      url: `${path}/:id`,
      headers: [],
      body: "",
      body_type: "none",
    },
    {
      name: `Create ${table.name}`,
      method: "POST",
      url: path,
      headers: JSON_HEADER,
      body: sampleBody,
      body_type: "json",
    },
    {
      name: `Update ${table.name}`,
      method: "PATCH",
      url: `${path}/:id`,
      headers: JSON_HEADER,
      body: sampleBody,
      body_type: "json",
    },
    {
      name: `Delete ${table.name}`,
      method: "DELETE",
      url: `${path}/:id`,
      headers: [],
      body: "",
      body_type: "none",
    },
  ];
}

/** Count saved API requests per table (by table_id). */
export async function countRequestsByTable(
  diagramId: string
): Promise<Record<string, number>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("diagram_api_requests")
    .select("table_id")
    .eq("diagram_id", diagramId)
    .not("table_id", "is", null);
  if (error) throw new Error(error.message);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = row.table_id as string;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

/** Persist AI-suggested endpoints into a collection. */
export async function applyEndpointSuggestions(
  diagramId: string,
  collectionId: string,
  endpoints: SuggestedEndpoint[],
  tableIdByName: Record<string, string>,
  options?: { skipTableIds?: Set<string>; startSortOrder?: number }
): Promise<ApiRequest[]> {
  const skip = options?.skipTableIds ?? new Set<string>();
  let sortOrder = options?.startSortOrder ?? 0;
  const created: ApiRequest[] = [];

  for (const ep of endpoints) {
    let tableId: string | null = null;
    if (ep.table) {
      tableId = tableIdByName[ep.table.toLowerCase()] ?? null;
      if (tableId && skip.has(tableId)) continue;
    }

    const hasBody = !!ep.body?.trim();
    const headers: ApiHeader[] = hasBody
      ? [{ key: "Content-Type", value: "application/json" }]
      : [];

    const req = await createRequest({
      diagramId,
      collection_id: collectionId,
      table_id: tableId,
      name: ep.name,
      method: ep.method,
      url: `{{baseUrl}}${ep.path}`,
      headers,
      body: ep.body ?? "",
      body_type: hasBody ? "json" : "none",
      sort_order: sortOrder++,
    });
    created.push(req);
  }

  return created;
}
