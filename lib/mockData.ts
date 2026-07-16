import type { ErdColumn, ErdTable } from "@/lib/types";

/** Deterministic fake row count from table name. */
export function fakeRowCount(tableName: string): number {
  let h = 0;
  for (let i = 0; i < tableName.length; i++) {
    h = (h * 31 + tableName.charCodeAt(i)) >>> 0;
  }
  return 12 + (h % 240);
}

function seedValue(table: string, col: ErdColumn, row: number): string | number | boolean | null {
  const key = `${table}.${col.name}.${row}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 33 + key.charCodeAt(i)) >>> 0;

  if (col.is_pk) {
    if (col.data_type.includes("uuid")) {
      const hex = h.toString(16).padStart(8, "0");
      return `${hex.slice(0, 8)}-0000-4000-8000-${hex.padStart(12, "0").slice(0, 12)}`;
    }
    return row + 1;
  }

  const t = col.data_type.toLowerCase();
  if (t.includes("bool")) return h % 2 === 0;
  if (t.includes("int") || t.includes("numeric") || t.includes("decimal"))
    return (h % 1000) + row;
  if (t.includes("timestamp") || t.includes("date")) {
    const d = new Date(Date.UTC(2024, (h % 12), (h % 27) + 1));
    return d.toISOString();
  }
  if (t.includes("json")) return `{"n":${row},"seed":${h % 99}}`;
  if (col.is_fk) return String((h % 40) + 1);

  const words = ["alpha", "bravo", "pending", "active", "draft", "shipped", "open"];
  return `${words[h % words.length]}_${row}`;
}

export type FakeRow = Record<string, string | number | boolean | null> & {
  __rowId: string;
};

export function seedFakeRows(table: ErdTable, count = 8): FakeRow[] {
  return Array.from({ length: count }, (_, i) => {
    const row: FakeRow = { __rowId: `${table.id}-${i}` };
    for (const col of table.columns) {
      row[col.name] = seedValue(table.name, col, i);
    }
    return row;
  });
}

/** Stub NL → SQL for MVP. */
export function stubSqlFromPrompt(prompt: string, tableName: string): string {
  const p = prompt.toLowerCase();
  if (p.includes("count")) return `SELECT count(*) FROM ${tableName};`;
  if (p.includes("pending") || p.includes("status"))
    return `SELECT * FROM ${tableName} WHERE status = 'pending' ORDER BY created_at DESC LIMIT 50;`;
  if (p.includes("older") || p.includes("30"))
    return `SELECT * FROM ${tableName} WHERE created_at < now() - interval '30 days';`;
  return `SELECT * FROM ${tableName} LIMIT 25; -- generated from: ${prompt.slice(0, 60)}`;
}

export function mockBackendFiles(
  tables: ErdTable[],
  endpoints: { method: string; url: string; name: string }[]
): { path: string; kind: "route" | "db" | "util"; serves: string[] }[] {
  const files: { path: string; kind: "route" | "db" | "util"; serves: string[] }[] =
    [
      { path: "src/db/client.ts", kind: "db", serves: [] },
      { path: "src/db/schema.ts", kind: "db", serves: tables.map((t) => t.name) },
    ];

  for (const t of tables.slice(0, 12)) {
    files.push({
      path: `src/db/models/${t.name}.ts`,
      kind: "db",
      serves: [t.name],
    });
  }

  for (const ep of endpoints.slice(0, 20)) {
    const slug =
      ep.url
        .replace(/\{\{[^}]+\}\}/g, "")
        .replace(/^https?:\/\/[^/]+/, "")
        .replace(/^\//, "")
        .replace(/[/:]/g, "_")
        .replace(/_+/g, "_")
        .slice(0, 40) || "index";
    files.push({
      path: `src/routes/${ep.method.toLowerCase()}_${slug}.ts`,
      kind: "route",
      serves: [ep.name],
    });
  }

  files.push({
    path: "src/utils/errors.ts",
    kind: "util",
    serves: endpoints.map((e) => e.name).slice(0, 5),
  });

  return files;
}
