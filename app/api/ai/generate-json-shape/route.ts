import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You document JSONB columns in a Postgres schema for developers.

Given a table name, column name, table purpose, and sibling columns, return:
- json_description: ONE clear sentence explaining what this JSONB column stores and how it is used (like inline API docs). No quotes around the sentence.
- json_schema: A realistic example JSON value as a pretty-printed string (2-space indent) showing the expected shape. Use plausible field names and sample values.

Examples of good descriptions:
- "Full persona definition — the brain of a synthetic account."
- "Account metrics snapshot. Any metric may be null if the platform does not report it."
- "Ayrshare per-post publish options."

Respond ONLY with strict JSON:
{ "json_description": "string", "json_schema": "string" }`;

function normalizeSchema(raw: unknown): string {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return "{}";
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return trimmed;
    }
  }
  if (raw && typeof raw === "object") {
    return JSON.stringify(raw, null, 2);
  }
  return "{}";
}

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
      { error: "AI key is not configured." },
      { status: 500 }
    );
  }

  let body: {
    table_name?: string;
    column_name?: string;
    table_description?: string;
    sibling_columns?: { name: string; data_type: string }[];
    product_context?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tableName = String(body.table_name ?? "").trim();
  const columnName = String(body.column_name ?? "").trim();
  if (!tableName || !columnName) {
    return NextResponse.json(
      { error: "table_name and column_name are required." },
      { status: 400 }
    );
  }

  const userPrompt = `Table: ${tableName}
Column: ${columnName}
Table purpose: ${(body.table_description ?? "").slice(0, 500) || "(not provided)"}
Product context: ${(body.product_context ?? "").slice(0, 500) || "(not provided)"}
Other columns on this table:
${JSON.stringify(body.sibling_columns ?? [], null, 2)}

Generate json_description and json_schema for ${tableName}.${columnName}.`;

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
    let parsed: { json_description?: unknown; json_schema?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "AI returned an unparseable response." },
        { status: 502 }
      );
    }

    const json_description = String(parsed.json_description ?? "").trim();
    const json_schema = normalizeSchema(parsed.json_schema);

    if (!json_description) {
      return NextResponse.json(
        { error: "AI did not return a description." },
        { status: 502 }
      );
    }

    return NextResponse.json({ json_description, json_schema });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
