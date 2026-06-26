import { NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ALLOWED_METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);
const MAX_BODY_BYTES = 1_000_000; // 1 MB response cap
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 30_000;

function ipv4IsPrivate(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true; // loopback
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function ipv6IsPrivate(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === "::1" || v === "::") return true; // loopback / unspecified
  if (v.startsWith("fe80")) return true; // link-local
  if (v.startsWith("fc") || v.startsWith("fd")) return true; // unique local
  // IPv4-mapped (::ffff:a.b.c.d)
  const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4IsPrivate(mapped[1]);
  return false;
}

function ipIsPrivate(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return ipv4IsPrivate(ip);
  if (kind === 6) return ipv6IsPrivate(ip);
  return true; // unknown format — reject
}

/** Reject non-http(s) URLs and hosts that resolve to private/loopback IPs. */
async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed");
  }

  const host = url.hostname;
  // If the host is a literal IP, check it directly.
  if (isIP(host)) {
    if (ipIsPrivate(host)) throw new Error("Requests to private addresses are blocked");
    return url;
  }

  // Otherwise resolve every address and reject if any is private.
  const records = await lookup(host, { all: true });
  if (records.length === 0) throw new Error("Could not resolve host");
  for (const rec of records) {
    if (ipIsPrivate(rec.address)) {
      throw new Error("Requests to private addresses are blocked");
    }
  }
  return url;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let payload: {
    diagramId?: string;
    method?: string;
    url?: string;
    headers?: { key: string; value: string }[];
    body?: string;
    timeoutMs?: number;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { diagramId, url, body } = payload;
  const method = (payload.method ?? "GET").toUpperCase();

  if (!diagramId || !url) {
    return NextResponse.json(
      { error: "diagramId and url are required" },
      { status: 400 }
    );
  }
  if (!ALLOWED_METHODS.has(method)) {
    return NextResponse.json({ error: "Unsupported method" }, { status: 400 });
  }

  // Verify the user can access this diagram (RLS returns the row only if so).
  const { data: diagram } = await supabase
    .from("diagrams")
    .select("id")
    .eq("id", diagramId)
    .maybeSingle();
  if (!diagram) {
    return NextResponse.json({ error: "Diagram not found" }, { status: 403 });
  }

  let safeUrl: URL;
  try {
    safeUrl = await assertSafeUrl(url);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Blocked URL" },
      { status: 400 }
    );
  }

  const headers = new Headers();
  for (const h of payload.headers ?? []) {
    if (h.key.trim()) headers.set(h.key, h.value);
  }

  const timeoutMs = Math.min(
    payload.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    MAX_TIMEOUT_MS
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const started = Date.now();
  try {
    const hasBody = method !== "GET" && method !== "HEAD" && !!body;
    const res = await fetch(safeUrl.toString(), {
      method,
      headers,
      body: hasBody ? body : undefined,
      redirect: "follow",
      signal: controller.signal,
    });

    const buf = await res.arrayBuffer();
    const clipped = buf.byteLength > MAX_BODY_BYTES;
    const text = new TextDecoder().decode(
      clipped ? buf.slice(0, MAX_BODY_BYTES) : buf
    );

    const resHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      resHeaders[key] = value;
    });

    return NextResponse.json({
      status: res.status,
      statusText: res.statusText,
      headers: resHeaders,
      body: clipped ? `${text}\n\n… response truncated at 1 MB` : text,
      durationMs: Date.now() - started,
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return NextResponse.json(
      {
        error: aborted
          ? `Request timed out after ${timeoutMs}ms`
          : e instanceof Error
            ? e.message
            : "Request failed",
      },
      { status: 502 }
    );
  } finally {
    clearTimeout(timer);
  }
}
