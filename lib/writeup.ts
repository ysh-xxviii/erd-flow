import type { ApiRequest, HttpMethod, WriteupStep } from "@/lib/types";

function stepId(i: number) {
  return `step-${i}`;
}

/** Generate a default writeup from method/path/table for MVP. */
export function defaultWriteup(req: {
  method: HttpMethod;
  name: string;
  url: string;
  tableName?: string | null;
}): { intro: string; steps: WriteupStep[] } {
  const table = req.tableName ?? "resource";
  const path = req.url.replace(/\{\{[^}]+\}\}/g, "").replace(/^https?:\/\/[^/]+/, "") || "/";

  const intro = `${req.method} ${path} handles ${req.name.toLowerCase()} against ⌗${table}. The steps below follow the most efficient implementation sequence.`;

  const steps: WriteupStep[] = [
    {
      id: stepId(0),
      title: "Validate request",
      body: `Parse and validate incoming params/body for ${req.name}. Reject invalid input early.`,
    },
    {
      id: stepId(1),
      title: `Fetch ⌗${table} by PK`,
      body: `Load ⌗${table} with an early 404 when the row is missing.`,
    },
    {
      id: stepId(2),
      title: "Batch relation loads",
      body: `Prefetch related rows in one round trip via ƒloadRelations before computing in memory.`,
    },
  ];

  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    steps.push({
      id: stepId(3),
      title: "Apply mutations",
      body: `Persist changes to ⌗${table} and related rows, then recompute derived fields.`,
    });
  }

  steps.push({
    id: stepId(steps.length),
    title: req.method === "POST" ? "Respond 201" : "Respond 200",
    body: `Return the response payload for ${req.name}.`,
  });

  return { intro, steps };
}

/** Heuristic: needs an action verb AND an object. */
export function senseCheckWriteupText(text: string): {
  ok: boolean;
  error?: string;
  behaviorChange?: boolean;
} {
  const t = text.trim();
  if (!t) return { ok: false, error: "Step cannot be empty." };

  const verbs =
    /\b(validate|fetch|load|query|insert|update|delete|compute|apply|respond|return|check|parse|batch|save|create|send|reject|map|filter|join)\b/i;
  const objects =
    /\b(request|body|param|table|row|column|status|404|200|201|400|500|payload|relation|discount|token|user|order|id|[a-z_]+\.[a-z_]+|ƒ\w+|⌗[\w.]+)\b/i;

  if (!verbs.test(t)) {
    return {
      ok: false,
      error: "Needs an action verb (e.g. validate, fetch, respond).",
    };
  }
  if (!objects.test(t) && !/respond\s+\d{3}/i.test(t)) {
    return {
      ok: false,
      error: "Needs an object (field, table, function, value, or status code).",
    };
  }

  // Wording-only if short soft synonyms; MVP: treat substantial length + verb as behavior when chips/tokens change
  const behaviorChange =
    /\b(delete|insert|update|create|fetch|load|respond|return|apply)\b/i.test(t);

  return { ok: true, behaviorChange };
}

export function autoTitleFromBody(body: string): string {
  const respond = body.match(/\brespond(?:s|ing)?\s+(\d{3})\b/i);
  if (respond) return `Respond ${respond[1]}`;
  const m = body.match(
    /\b(validate|fetch|load|query|insert|update|delete|compute|apply|return|check|parse|batch|save|create|send)\b\s+(.{0,40}?)(?:\.|$)/i
  );
  if (m) {
    const verb = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
    const obj = m[2].trim().replace(/[,;:].*$/, "").slice(0, 36);
    return obj ? `${verb} ${obj}` : verb;
  }
  return body.slice(0, 40) || "Step";
}

export function resolveWriteup(req: ApiRequest, tableName?: string | null) {
  if (req.writeup_intro || (req.writeup_steps && req.writeup_steps.length > 0)) {
    return {
      intro: req.writeup_intro ?? "",
      steps: req.writeup_steps ?? [],
      isOverride: true,
    };
  }
  const d = defaultWriteup({
    method: req.method,
    name: req.name,
    url: req.url,
    tableName,
  });
  return { ...d, isOverride: false };
}
