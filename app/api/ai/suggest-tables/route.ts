import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import type { SchemaSnapshot, SuggestResponse } from "@/lib/types";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are an expert relational database architect.
Given an existing (possibly empty) schema and an optional product description, design a COMPLETE, production-ready Postgres schema by suggesting NEW tables. Produce a full schema like a senior engineer would ship, organized into clear categories.

Each suggested table must be tagged with a "category":
- "core": the main domain entities of the product (users, posts, accounts, etc.).
- "enum": a lookup/status type. Model it as a table whose columns ARE the allowed values (name = the value, e.g. "draft", "published"; data_type = "text"; is_pk false; is_nullable false; label = human-readable e.g. "Draft"). Reference it from core tables via a FK column.
- "framework": framework / infrastructure plumbing that real apps need. Include: password_reset_tokens, sessions, jobs, job_batches, failed_jobs, personal_access_tokens, cache, cache_locks.

Rules:
- Study the existing schema carefully: table categories, descriptions, constraints, relationships, column nullability, defaults, and json/jsonb schemas.
- Do NOT repeat tables that already exist.
- Suggest 8 to 14 tables total: cover core domain, at least 1 enum when a status/type makes sense, and the common framework/infra tables.
- Use snake_case names with common conventions.
- Every core/framework table must include a primary key column (usually "id" of type uuid, is_pk true, is_nullable false).
- Use realistic Postgres data types with lengths where helpful: uuid, text, varchar(255), integer, bigint, numeric, boolean, date, timestamptz, json, jsonb.
- Use "jsonb" for flexible/structured attributes (settings, metadata, analytics, schema, options).
- For every json/jsonb column you MUST include "json_description" (one clear sentence, like API docs) and "json_schema" (pretty-printed example JSON string). Never leave these null on json/jsonb columns.
- Example json_description: "Full persona definition — the brain of a synthetic account."
- Foreign key columns should be named like "<table>_id", data_type uuid, is_fk true.
- Include "default_value" on columns when they have a sensible default (e.g. "active", "draft", "0").
- Include "description" on each table: one short sentence explaining its purpose (shown under the table header).
- Include "constraints" array with unique and index definitions: { "kind": "unique"|"index", "columns": ["col1","col2"] }.
- For each table, include "relationships" with from_column pointing to the FK column on THIS table.
- Provide a short "reason" (max 12 words) for each table.

Respond ONLY with strict JSON matching this shape:
{
  "suggestions": [
    {
      "name": "string",
      "category": "core" | "enum" | "framework",
      "reason": "string",
      "description": "string",
      "columns": [
        { "name": "string", "data_type": "string", "is_pk": boolean, "is_fk": boolean, "is_nullable": boolean, "default_value": "string or null", "label": "string or null", "json_description": "string or null", "json_schema": "string or null" }
      ],
      "constraints": [
        { "kind": "unique" | "index", "columns": ["string"] }
      ],
      "relationships": [
        { "to_table": "string", "from_column": "string", "cardinality": "one-to-one" | "one-to-many" | "many-to-many" }
      ]
    }
  ]
}`;

export async function POST(request: Request) {
  // Require an authenticated user.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "AI key is not configured. Set OPENAI_API_KEY (works with OpenAI, Groq, or any OpenAI-compatible provider).",
      },
      { status: 500 }
    );
  }

  let body: { description?: string; schema?: SchemaSnapshot };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const description = (body.description ?? "").slice(0, 2000);
  const schema = body.schema ?? { tables: [] };

  const userPrompt = `Existing schema (detailed JSON — tables, columns, constraints, relationships):
${JSON.stringify(schema, null, 2)}

Product description (may be empty): "${description}"

Suggest the related tables now. Respect existing relationships when wiring FKs on new tables.`;

  try {
    // baseURL lets you point at any OpenAI-compatible provider (Groq, Together,
    // OpenRouter, a local Ollama server, etc.). Defaults to OpenAI.
    const client = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: SuggestResponse;
    try {
      parsed = JSON.parse(raw) as SuggestResponse;
    } catch {
      return NextResponse.json(
        { error: "AI returned an unparseable response. Try again." },
        { status: 502 }
      );
    }

    const existing = new Set(
      (schema.tables ?? []).map((t) => t.name.toLowerCase())
    );
    const normalizeCategory = (c: unknown): "core" | "framework" | "enum" =>
      c === "framework" || c === "enum" ? c : "core";

    const normalizeConstraints = (raw: unknown) => {
      if (!Array.isArray(raw)) return [];
      return raw
        .filter(
          (c) =>
            c &&
            typeof c === "object" &&
            (c.kind === "unique" || c.kind === "index") &&
            Array.isArray(c.columns)
        )
        .map((c) => ({
          kind: c.kind as "unique" | "index",
          columns: c.columns.filter((col: unknown) => typeof col === "string"),
        }));
    };

    const normalizeColumn = (raw: unknown) => {
      if (!raw || typeof raw !== "object") return null;
      const col = raw as Record<string, unknown>;
      const name = String(col.name ?? "").trim();
      if (!name) return null;
      const dataType = String(col.data_type ?? "text");
      const isJson = /json/i.test(dataType);
      let jsonSchema = col.json_schema ?? null;
      if (jsonSchema && typeof jsonSchema === "object") {
        jsonSchema = JSON.stringify(jsonSchema, null, 2);
      } else if (typeof jsonSchema === "string") {
        jsonSchema = jsonSchema.trim() || null;
      } else {
        jsonSchema = null;
      }
      return {
        name,
        data_type: dataType,
        is_pk: !!col.is_pk,
        is_fk: !!col.is_fk,
        is_nullable:
          typeof col.is_nullable === "boolean" ? col.is_nullable : true,
        default_value:
          col.default_value === null || col.default_value === undefined
            ? null
            : String(col.default_value),
        label:
          col.label === null || col.label === undefined
            ? null
            : String(col.label),
        json_description:
          isJson && col.json_description
            ? String(col.json_description).trim()
            : null,
        json_schema: isJson && jsonSchema ? String(jsonSchema) : null,
      };
    };

    const suggestions = (parsed.suggestions ?? [])
      .filter((s) => s && s.name && !existing.has(s.name.toLowerCase()))
      .slice(0, 14)
      .map((s) => ({
        name: s.name,
        category: normalizeCategory(s.category),
        reason: s.reason ?? "",
        description: s.description ?? "",
        columns: Array.isArray(s.columns)
          ? s.columns
              .map(normalizeColumn)
              .filter((c): c is NonNullable<typeof c> => c !== null)
          : [],
        constraints: normalizeConstraints(s.constraints),
        relationships: Array.isArray(s.relationships) ? s.relationships : [],
      }));

    return NextResponse.json({ suggestions } satisfies SuggestResponse);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "AI request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
