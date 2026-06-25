// Pure playbook step verification against live ERD state.

import type {
  ErdRelationship,
  ErdTable,
  PlaybookCheckType,
  PlaybookCriteria,
  PlaybookStep,
  PlaybookStepEval,
  PlaybookStepStatus,
} from "@/lib/types";

function norm(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function findTable(tables: ErdTable[], name: string): ErdTable | undefined {
  const key = norm(name);
  return tables.find((t) => norm(t.name) === key);
}

function checkCriteria(
  checkType: PlaybookCheckType,
  criteria: PlaybookCriteria,
  tables: ErdTable[],
  relationships: ErdRelationship[]
): boolean {
  switch (checkType) {
    case "manual":
      return false;
    case "table_exists":
      return !!findTable(tables, criteria.table ?? "");
    case "column_exists": {
      const table = findTable(tables, criteria.table ?? "");
      if (!table) return false;
      const col = norm(criteria.column);
      return table.columns.some((c) => norm(c.name) === col);
    }
    case "relationship_exists": {
      const from = findTable(tables, criteria.from_table ?? "");
      const to = findTable(tables, criteria.to_table ?? "");
      if (!from || !to) return false;
      return relationships.some(
        (r) =>
          (r.source_table_id === from.id && r.target_table_id === to.id) ||
          (r.source_table_id === to.id && r.target_table_id === from.id)
      );
    }
    default:
      return false;
  }
}

export function evaluateStep(
  step: PlaybookStep,
  tables: ErdTable[],
  relationships: ErdRelationship[]
): PlaybookStepStatus {
  if (step.check_type === "manual") {
    return step.is_done ? "done" : "pending";
  }
  const verified = checkCriteria(
    step.check_type,
    step.criteria,
    tables,
    relationships
  );
  return verified ? "auto_verified" : "pending";
}

export function evaluateAllSteps(
  steps: PlaybookStep[],
  tables: ErdTable[],
  relationships: ErdRelationship[]
): PlaybookStepEval[] {
  return steps.map((step) => ({
    step,
    status: evaluateStep(step, tables, relationships),
  }));
}

export function isStepComplete(status: PlaybookStepStatus): boolean {
  return status === "done" || status === "auto_verified";
}

export function playbookProgress(
  evals: PlaybookStepEval[]
): { done: number; total: number } {
  const total = evals.length;
  const done = evals.filter((e) => isStepComplete(e.status)).length;
  return { done, total };
}

/** Resolve a table id to focus/highlight for a step's "Go to" action. */
export function resolveStepTargetTableId(
  step: PlaybookStep,
  tables: ErdTable[]
): string | null {
  const c = step.criteria;
  switch (step.check_type) {
    case "table_exists":
      return findTable(tables, c.table ?? "")?.id ?? null;
    case "column_exists":
      return findTable(tables, c.table ?? "")?.id ?? null;
    case "relationship_exists": {
      return (
        findTable(tables, c.from_table ?? "")?.id ??
        findTable(tables, c.to_table ?? "")?.id ??
        null
      );
    }
    default:
      return null;
  }
}

export function stepNeedsAddTableForm(step: PlaybookStep): boolean {
  return (
    step.check_type === "table_exists" &&
    !!step.criteria.table?.trim()
  );
}

export const PLAYBOOK_TEMPLATES: {
  name: string;
  steps: Omit<
    PlaybookStep,
    "id" | "diagram_id" | "is_done" | "done_at" | "done_by" | "created_at"
  >[];
}[] = [
  {
    name: "New module",
    steps: [
      {
        ordinal: 0,
        title: "Add users table",
        instructions:
          "Create a core `users` table with at least an id and email column.",
        check_type: "table_exists",
        criteria: { table: "users" },
      },
      {
        ordinal: 1,
        title: "Add domain table",
        instructions:
          "Add your main entity table (e.g. `orders` or `projects`).",
        check_type: "table_exists",
        criteria: { table: "orders" },
      },
      {
        ordinal: 2,
        title: "Link domain to users",
        instructions:
          "Draw a relationship from orders to users (FK on orders.user_id).",
        check_type: "relationship_exists",
        criteria: { from_table: "orders", to_table: "users" },
      },
      {
        ordinal: 3,
        title: "Review with lead",
        instructions: "Walk through the canvas with your lead before exporting SQL.",
        check_type: "manual",
        criteria: {},
      },
    ],
  },
  {
    name: "Add enum + FK",
    steps: [
      {
        ordinal: 0,
        title: "Add status enum table",
        instructions: "Create an enum lookup table (e.g. `order_status`).",
        check_type: "table_exists",
        criteria: { table: "order_status" },
      },
      {
        ordinal: 1,
        title: "Add status_id column",
        instructions: "On the orders table, add a `status_id` FK column.",
        check_type: "column_exists",
        criteria: { table: "orders", column: "status_id" },
      },
      {
        ordinal: 2,
        title: "Connect orders to status",
        instructions: "Draw a line from orders.status_id to order_status.",
        check_type: "relationship_exists",
        criteria: { from_table: "orders", to_table: "order_status" },
      },
    ],
  },
  {
    name: "Review JSON shapes",
    steps: [
      {
        ordinal: 0,
        title: "Open each JSONB shape",
        instructions:
          "In the sidebar under JSONB shapes, click each entry and confirm the generated schema.",
        check_type: "manual",
        criteria: {},
      },
      {
        ordinal: 1,
        title: "Fix missing descriptions",
        instructions:
          "Double-click tables with jsonb columns and ensure descriptions look correct.",
        check_type: "manual",
        criteria: {},
      },
    ],
  },
];
