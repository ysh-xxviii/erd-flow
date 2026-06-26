import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import type {
  HttpMethod,
  SchemaSnapshot,
  SuggestEndpointsResponse,
} from "@/lib/types";

export const runtime = "nodejs";

const ALLOWED_METHODS = new Set<HttpMethod>([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);

const SYSTEM_PROMPT = `You are an expert REST API designer.
Given a detailed database schema (tables, columns, constraints, relationships, and json/jsonb column schemas), design a practical REST API that a backend team would implement.

Rules:
- Produce endpoints for each core table: list, get-by-id, create, update, delete where appropriate.
- Use the "relationships" array to add nested/sub-resource routes (e.g. GET /users/:userId/posts).
- Include cross-cutting endpoints when relevant (e.g. POST /auth/login, GET /health) with table set to null.
- Paths must start with / and use resource names matching table names.
- Use :id or :paramName for path parameters (not {id}).
- POST/PATCH/PUT bodies must be realistic JSON strings:
  - Include all writable non-PK columns for create/update.
  - Respect is_nullable: omit or null nullable fields when appropriate.
  - Use default_value when present.
  - For json/jsonb columns, use the provided json_schema example as the field value (parsed as JSON).
  - Use plausible sample values per data_type (uuid, email for *email* columns, ISO dates for timestamps).
- GET and DELETE should have empty body string.
- Set "description" to a clear one-sentence summary of what the endpoint does.
- Keep names short and clear (e.g. "List users", "Create order").
- Do not invent tables that are not in the schema unless they are cross-cutting (table null).

Respond ONLY with strict JSON:
{
  "endpoints": [
    {
      "table": "users or null for cross-cutting",
      "name": "string",
      "method": "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
      "path": "/users",
      "body": "JSON string or empty",
      "description": "one sentence"
    }
  ]
}`;

export async function POST(request: Request) {
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

  if (!schema.tables?.length) {
    return NextResponse.json(
      { error: "Schema must include at least one table." },
      { status: 400 }
    );
  }

  const tableNames = new Set(
    schema.tables.map((t) => t.name.toLowerCase())
  );

  const userPrompt = `Detailed schema (JSON):
${JSON.stringify(schema, null, 2)}

Product context (may be empty): "${description}"

Design REST endpoints for this schema. Use column metadata, json_schema examples, constraints, and relationships to produce accurate request bodies and nested routes.`;

  try {
    const client = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: SuggestEndpointsResponse;
    try {
      parsed = JSON.parse(raw) as SuggestEndpointsResponse;
    } catch {
      return NextResponse.json(
        { error: "AI returned an unparseable response. Try again." },
        { status: 502 }
      );
    }

    const endpoints = (parsed.endpoints ?? [])
      .filter((e) => e && e.name && e.path)
      .map((e) => {
        const method = String(e.method ?? "GET").toUpperCase() as HttpMethod;
        const safeMethod = ALLOWED_METHODS.has(method) ? method : "GET";
        let path = String(e.path).trim();
        if (!path.startsWith("/")) path = `/${path}`;
        const table =
          e.table === null || e.table === undefined
            ? null
            : String(e.table).trim() || null;
        if (table && !tableNames.has(table.toLowerCase())) return null;
        const bodyStr =
          typeof e.body === "string"
            ? e.body
            : e.body
              ? JSON.stringify(e.body, null, 2)
              : "";
        return {
          table,
          name: String(e.name).trim(),
          method: safeMethod,
          path,
          body: bodyStr,
          description: e.description ? String(e.description).trim() : "",
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .slice(0, 80);

    return NextResponse.json({ endpoints } satisfies SuggestEndpointsResponse);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "AI request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
