// Pure Postgres DDL generation from ERD diagram data.
// No I/O, no network — safe to run in the browser. Produces migration SQL and
// diffs between a previously saved snapshot and the live schema.

import type { ErdConstraint, ErdRelationship, ErdTable } from "@/lib/types";

export interface MigrationColumn {
  name: string;
  data_type: string;
  is_pk: boolean;
  is_nullable: boolean;
  default_value: string | null;
}

export interface MigrationTable {
  name: string;
  category: string;
  columns: MigrationColumn[];
  constraints: ErdConstraint[];
}

export interface MigrationFk {
  source_table: string;
  source_col: string;
  target_table: string;
  target_col: string;
}

// Name-based, human-readable snapshot persisted as jsonb per migration version.
export interface MigrationSnapshot {
  tables: MigrationTable[];
  fks: MigrationFk[];
}

const SIMPLE_IDENT = /^[a-z_][a-z0-9_]*$/;

function quoteIdent(name: string): string {
  const trimmed = name.trim();
  if (SIMPLE_IDENT.test(trimmed)) return trimmed;
  return `"${trimmed.replace(/"/g, '""')}"`;
}

function fkName(fk: MigrationFk): string {
  const raw = `fk_${fk.source_table}_${fk.source_col}`;
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 60);
}

function indexName(table: string, columns: string[], kind: string): string {
  const raw = `${kind === "unique" ? "uq" : "idx"}_${table}_${columns.join("_")}`;
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 60);
}

/** Build a name-based snapshot from live ERD state (resolves column ids to names). */
export function buildSnapshot(
  tables: ErdTable[],
  relationships: ErdRelationship[]
): MigrationSnapshot {
  const tableById = new Map(tables.map((t) => [t.id, t]));

  const snapshotTables: MigrationTable[] = tables.map((t) => ({
    name: t.name,
    category: t.category,
    columns: [...t.columns]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((c) => ({
        name: c.name,
        data_type: c.data_type,
        is_pk: c.is_pk,
        is_nullable: c.is_nullable,
        default_value: c.default_value,
      })),
    constraints: t.constraints ?? [],
  }));

  const fks: MigrationFk[] = [];
  for (const r of relationships) {
    const srcTable = tableById.get(r.source_table_id);
    const tgtTable = tableById.get(r.target_table_id);
    if (!srcTable || !tgtTable) continue;
    const srcCol = srcTable.columns.find((c) => c.id === r.source_col_id);
    const tgtCol =
      tgtTable.columns.find((c) => c.id === r.target_col_id) ??
      tgtTable.columns.find((c) => c.is_pk) ??
      tgtTable.columns.find((c) => c.name === "id");
    if (!srcCol || !tgtCol) continue;
    fks.push({
      source_table: srcTable.name,
      source_col: srcCol.name,
      target_table: tgtTable.name,
      target_col: tgtCol.name,
    });
  }

  return { tables: snapshotTables, fks };
}

/** Order tables so referenced (target) tables are created before the tables that reference them. */
function topoSort(snapshot: MigrationSnapshot): MigrationTable[] {
  const byName = new Map(snapshot.tables.map((t) => [t.name.toLowerCase(), t]));
  const deps = new Map<string, Set<string>>();
  for (const t of snapshot.tables) deps.set(t.name.toLowerCase(), new Set());

  for (const fk of snapshot.fks) {
    const src = fk.source_table.toLowerCase();
    const tgt = fk.target_table.toLowerCase();
    if (src === tgt) continue; // self-reference handled via ALTER later
    if (deps.has(src) && byName.has(tgt)) deps.get(src)!.add(tgt);
  }

  const ordered: MigrationTable[] = [];
  const visited = new Set<string>();
  const inProgress = new Set<string>();

  const visit = (key: string) => {
    if (visited.has(key) || inProgress.has(key)) return;
    inProgress.add(key);
    for (const dep of deps.get(key) ?? []) visit(dep);
    inProgress.delete(key);
    visited.add(key);
    const table = byName.get(key);
    if (table) ordered.push(table);
  };

  for (const t of snapshot.tables) visit(t.name.toLowerCase());
  return ordered;
}

function columnDef(col: MigrationColumn): string {
  let def = `  ${quoteIdent(col.name)} ${col.data_type}`;
  if (!col.is_nullable) def += " not null";
  if (col.default_value != null && col.default_value !== "") {
    def += ` default ${col.default_value}`;
  }
  return def;
}

function createTableStmt(table: MigrationTable): string {
  const lines: string[] = table.columns.map(columnDef);

  const pkCols = table.columns.filter((c) => c.is_pk).map((c) => c.name);
  if (pkCols.length > 0) {
    lines.push(`  primary key (${pkCols.map(quoteIdent).join(", ")})`);
  }

  for (const c of table.constraints ?? []) {
    if (c.kind === "unique" && c.columns.length > 0) {
      lines.push(`  unique (${c.columns.map(quoteIdent).join(", ")})`);
    }
  }

  return `create table if not exists ${quoteIdent(table.name)} (\n${lines.join(",\n")}\n);`;
}

function indexStmts(table: MigrationTable): string[] {
  const stmts: string[] = [];
  for (const c of table.constraints ?? []) {
    if (c.kind === "index" && c.columns.length > 0) {
      stmts.push(
        `create index if not exists ${quoteIdent(
          indexName(table.name, c.columns, "index")
        )} on ${quoteIdent(table.name)} (${c.columns.map(quoteIdent).join(", ")});`
      );
    }
  }
  return stmts;
}

function addFkStmt(fk: MigrationFk): string {
  return `alter table ${quoteIdent(fk.source_table)} add constraint ${quoteIdent(
    fkName(fk)
  )} foreign key (${quoteIdent(fk.source_col)}) references ${quoteIdent(
    fk.target_table
  )} (${quoteIdent(fk.target_col)}) on delete cascade;`;
}

function dropFkStmt(fk: MigrationFk): string {
  return `alter table ${quoteIdent(fk.source_table)} drop constraint if exists ${quoteIdent(
    fkName(fk)
  )};`;
}

/** Full CREATE script for the entire schema. */
export function generateCreateSql(snapshot: MigrationSnapshot): string {
  if (snapshot.tables.length === 0) {
    return "-- No tables in this diagram yet.\n";
  }

  const ordered = topoSort(snapshot);
  const blocks: string[] = [];

  blocks.push("-- Tables");
  for (const t of ordered) blocks.push(createTableStmt(t));

  const indexes = ordered.flatMap(indexStmts);
  if (indexes.length > 0) {
    blocks.push("\n-- Indexes");
    blocks.push(...indexes);
  }

  if (snapshot.fks.length > 0) {
    blocks.push("\n-- Foreign keys");
    blocks.push(...snapshot.fks.map(addFkStmt));
  }

  return blocks.join("\n") + "\n";
}

function fkKey(fk: MigrationFk): string {
  return `${fk.source_table}.${fk.source_col}->${fk.target_table}.${fk.target_col}`.toLowerCase();
}

function colsEqual(a: MigrationColumn, b: MigrationColumn): boolean {
  return (
    a.data_type === b.data_type &&
    a.is_nullable === b.is_nullable &&
    (a.default_value ?? "") === (b.default_value ?? "") &&
    a.is_pk === b.is_pk
  );
}

/**
 * Diff a previously saved snapshot against the current schema and emit the
 * ALTER/CREATE/DROP statements needed to migrate from prev to current.
 * Falls back to a full create script when there is no previous snapshot.
 */
export function generateDiffSql(
  prev: MigrationSnapshot | null,
  current: MigrationSnapshot
): string {
  if (!prev || !prev.tables || prev.tables.length === 0) {
    return generateCreateSql(current);
  }

  const prevByName = new Map(prev.tables.map((t) => [t.name.toLowerCase(), t]));
  const currByName = new Map(current.tables.map((t) => [t.name.toLowerCase(), t]));

  const blocks: string[] = [];

  // Dropped FKs first so dependent tables can be dropped cleanly.
  const prevFks = prev.fks ?? [];
  const prevFkKeys = new Set(prevFks.map(fkKey));
  const currFkKeys = new Set(current.fks.map(fkKey));
  const droppedFks = prevFks.filter((fk) => !currFkKeys.has(fkKey(fk)));
  if (droppedFks.length > 0) {
    blocks.push("-- Drop removed foreign keys");
    blocks.push(...droppedFks.map(dropFkStmt));
  }

  // Dropped tables.
  const droppedTables = prev.tables.filter(
    (t) => !currByName.has(t.name.toLowerCase())
  );
  if (droppedTables.length > 0) {
    blocks.push("\n-- Drop removed tables");
    for (const t of droppedTables) {
      blocks.push(`drop table if exists ${quoteIdent(t.name)} cascade;`);
    }
  }

  // New tables (ordered so dependencies come first).
  const newTables = current.tables.filter(
    (t) => !prevByName.has(t.name.toLowerCase())
  );
  if (newTables.length > 0) {
    const newSnapshot: MigrationSnapshot = {
      tables: newTables,
      fks: current.fks.filter((fk) =>
        newTables.some((t) => t.name.toLowerCase() === fk.source_table.toLowerCase())
      ),
    };
    blocks.push("\n-- New tables");
    for (const t of topoSort(newSnapshot)) blocks.push(createTableStmt(t));
    const newIndexes = newTables.flatMap(indexStmts);
    if (newIndexes.length > 0) blocks.push(...newIndexes);
  }

  // Altered columns on tables that exist in both snapshots.
  const alterBlocks: string[] = [];
  for (const curr of current.tables) {
    const before = prevByName.get(curr.name.toLowerCase());
    if (!before) continue;

    const beforeCols = new Map(before.columns.map((c) => [c.name.toLowerCase(), c]));
    const currCols = new Map(curr.columns.map((c) => [c.name.toLowerCase(), c]));

    const stmts: string[] = [];

    for (const col of curr.columns) {
      const old = beforeCols.get(col.name.toLowerCase());
      if (!old) {
        stmts.push(
          `alter table ${quoteIdent(curr.name)} add column ${columnDef(col).trim()};`
        );
        continue;
      }
      if (colsEqual(old, col)) continue;
      if (old.data_type !== col.data_type) {
        stmts.push(
          `alter table ${quoteIdent(curr.name)} alter column ${quoteIdent(
            col.name
          )} type ${col.data_type};`
        );
      }
      if (old.is_nullable !== col.is_nullable) {
        stmts.push(
          `alter table ${quoteIdent(curr.name)} alter column ${quoteIdent(col.name)} ${
            col.is_nullable ? "drop not null" : "set not null"
          };`
        );
      }
      if ((old.default_value ?? "") !== (col.default_value ?? "")) {
        stmts.push(
          col.default_value != null && col.default_value !== ""
            ? `alter table ${quoteIdent(curr.name)} alter column ${quoteIdent(
                col.name
              )} set default ${col.default_value};`
            : `alter table ${quoteIdent(curr.name)} alter column ${quoteIdent(
                col.name
              )} drop default;`
        );
      }
    }

    for (const col of before.columns) {
      if (!currCols.has(col.name.toLowerCase())) {
        stmts.push(
          `alter table ${quoteIdent(curr.name)} drop column if exists ${quoteIdent(
            col.name
          )};`
        );
      }
    }

    if (stmts.length > 0) {
      alterBlocks.push(`-- Alter ${curr.name}`);
      alterBlocks.push(...stmts);
    }
  }
  if (alterBlocks.length > 0) {
    blocks.push("\n-- Column changes");
    blocks.push(...alterBlocks);
  }

  // Added FKs (skip ones already covered by brand-new tables? keep idempotent — they use add constraint).
  const addedFks = current.fks.filter((fk) => !prevFkKeys.has(fkKey(fk)));
  if (addedFks.length > 0) {
    blocks.push("\n-- New foreign keys");
    blocks.push(...addedFks.map(addFkStmt));
  }

  if (blocks.length === 0) return "-- No schema changes since the last saved migration.\n";
  return blocks.join("\n") + "\n";
}
