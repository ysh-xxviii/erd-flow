import pg from "pg";
import { decryptSecret } from "@/lib/crypto";

const { Client } = pg;

const MAX_ROWS = 500;
const CONNECT_TIMEOUT_MS = 8_000;
const QUERY_TIMEOUT_MS = 15_000;

export type DbConnectMeta = {
  host: string;
  database: string;
  user: string;
  ssl: boolean;
};

/** Parse a postgres connection URL into display metadata (no password). */
export function parseConnectionMeta(connectionString: string): DbConnectMeta {
  const url = new URL(connectionString);
  if (!url.protocol.startsWith("postgres")) {
    throw new Error("Connection string must be postgres:// or postgresql://");
  }
  return {
    host: url.hostname || "localhost",
    database: (url.pathname || "/").replace(/^\//, "") || "postgres",
    user: decodeURIComponent(url.username || "postgres"),
    ssl: url.searchParams.get("sslmode") !== "disable",
  };
}

function assertSafeConnectionString(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid connection string");
  }
  if (!url.protocol.startsWith("postgres")) {
    throw new Error("Only postgres:// connection strings are supported");
  }
}

export async function withCustomerClient<T>(
  cipher: string,
  fn: (client: pg.Client) => Promise<T>
): Promise<T> {
  const connectionString = decryptSecret(cipher);
  assertSafeConnectionString(connectionString);
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
    ssl: connectionString.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function testCustomerConnection(connectionString: string): Promise<DbConnectMeta> {
  assertSafeConnectionString(connectionString);
  const meta = parseConnectionMeta(connectionString);
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    ssl: connectionString.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
  });
  await client.connect();
  try {
    await client.query("select 1 as ok");
  } finally {
    await client.end().catch(() => undefined);
  }
  return meta;
}

export async function fetchTableRows(
  cipher: string,
  tableName: string
): Promise<{ columns: string[]; rows: Record<string, unknown>[]; rowCount: number }> {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    throw new Error("Invalid table name");
  }
  return withCustomerClient(cipher, async (client) => {
    const countRes = await client.query(
      `select count(*)::int as c from ${quoteIdent(tableName)}`
    );
    const rowCount = (countRes.rows[0]?.c as number) ?? 0;
    const res = await client.query(
      `select * from ${quoteIdent(tableName)} limit $1`,
      [MAX_ROWS]
    );
    const columns = res.fields.map((f) => f.name);
    const rows = res.rows.map((r) => {
      const out: Record<string, unknown> = {};
      for (const c of columns) out[c] = serializeCell(r[c]);
      return out;
    });
    return { columns, rows, rowCount };
  });
}

export async function runReadQuery(
  cipher: string,
  sql: string
): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
  const trimmed = sql.trim().replace(/;+\s*$/, "");
  if (!/^(select|with)\b/i.test(trimmed)) {
    throw new Error("Only SELECT / WITH queries are allowed here");
  }
  if (/\b(insert|update|delete|drop|alter|truncate|create|grant|revoke)\b/i.test(trimmed)) {
    throw new Error("Mutating statements are not allowed in read queries");
  }
  return withCustomerClient(cipher, async (client) => {
    const res = await client.query(trimmed);
    const columns = res.fields.map((f) => f.name);
    const rows = res.rows.slice(0, MAX_ROWS).map((r) => {
      const out: Record<string, unknown> = {};
      for (const c of columns) out[c] = serializeCell(r[c]);
      return out;
    });
    return { columns, rows };
  });
}

export async function executeStatements(
  cipher: string,
  statements: string[]
): Promise<{ applied: number; results: string[] }> {
  const cleaned = statements
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));
  if (cleaned.length === 0) throw new Error("No SQL statements to apply");

  return withCustomerClient(cipher, async (client) => {
    const results: string[] = [];
    await client.query("begin");
    try {
      for (const sql of cleaned) {
        const res = await client.query(sql);
        results.push(
          `${res.command || "OK"}${typeof res.rowCount === "number" ? ` (${res.rowCount})` : ""}`
        );
      }
      await client.query("commit");
    } catch (e) {
      await client.query("rollback").catch(() => undefined);
      throw e;
    }
    return { applied: cleaned.length, results };
  });
}

/** Split migration SQL into executable statements (naive but works for our generator). */
export function splitSqlStatements(sql: string): string[] {
  const lines = sql.split("\n");
  const withoutComments = lines
    .map((l) => {
      const idx = l.indexOf("--");
      if (idx >= 0) return l.slice(0, idx);
      return l;
    })
    .join("\n");
  return withoutComments
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function serializeCell(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return v.toString();
  if (Buffer.isBuffer(v)) return v.toString("base64");
  if (typeof v === "object") return v;
  return v;
}
