// Builds multi-phase canvas guides for Playbook "Go to" actions.

import { evaluateStep } from "@/lib/playbookCheck";
import type {
  ErdRelationship,
  ErdTable,
  PlaybookStep,
} from "@/lib/types";

function norm(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

export function findTableByName(
  tables: ErdTable[],
  name: string
): ErdTable | undefined {
  const key = norm(name);
  return tables.find((t) => norm(t.name) === key);
}

export type GuidePhase = {
  tableIds: string[];
  activeTableIds: string[];
  line?: { fromTableId: string; toTableId: string };
  pulseAddTable?: boolean;
  message: string;
  durationMs: number;
};

export type PlaybookGuide = {
  phases: GuidePhase[];
  fitTableIds: string[];
};

export function buildPlaybookGuide(
  step: PlaybookStep,
  tables: ErdTable[],
  relationships: ErdRelationship[]
): PlaybookGuide | null {
  const status = evaluateStep(step, tables, relationships);
  const complete = status === "done" || status === "auto_verified";
  const c = step.criteria;

  switch (step.check_type) {
    case "table_exists": {
      const name = c.table?.trim() ?? "table";
      const table = findTableByName(tables, name);
      if (!table) {
        return {
          fitTableIds: [],
          phases: [
            {
              tableIds: [],
              activeTableIds: [],
              pulseAddTable: true,
              message: `Type "${name}" in the sidebar and press Enter to add this table.`,
              durationMs: 4500,
            },
          ],
        };
      }
      if (complete) {
        return {
          fitTableIds: [table.id],
          phases: [
            {
              tableIds: [table.id],
              activeTableIds: [table.id],
              message: `"${table.name}" is ready. Double-click to edit columns if needed.`,
              durationMs: 3000,
            },
          ],
        };
      }
      return {
        fitTableIds: [table.id],
        phases: [
          {
            tableIds: [table.id],
            activeTableIds: [table.id],
            message: `Double-click "${table.name}" to add or edit columns.`,
            durationMs: 3500,
          },
        ],
      };
    }

    case "column_exists": {
      const tableName = c.table?.trim() ?? "table";
      const colName = c.column?.trim() ?? "column";
      const table = findTableByName(tables, tableName);
      if (!table) {
        return {
          fitTableIds: [],
          phases: [
            {
              tableIds: [],
              activeTableIds: [],
              pulseAddTable: true,
              message: `First add the "${tableName}" table from the sidebar.`,
              durationMs: 4000,
            },
          ],
        };
      }
      if (complete) {
        return {
          fitTableIds: [table.id],
          phases: [
            {
              tableIds: [table.id],
              activeTableIds: [table.id],
              message: `Column "${colName}" exists on "${table.name}".`,
              durationMs: 3000,
            },
          ],
        };
      }
      return {
        fitTableIds: [table.id],
        phases: [
          {
            tableIds: [table.id],
            activeTableIds: [table.id],
            message: `Select "${table.name}" on the canvas.`,
            durationMs: 2500,
          },
          {
            tableIds: [table.id],
            activeTableIds: [table.id],
            message: `Click Edit (or double-click) and add column "${colName}".`,
            durationMs: 4000,
          },
        ],
      };
    }

    case "relationship_exists": {
      const fromName = c.from_table?.trim() ?? "from";
      const toName = c.to_table?.trim() ?? "to";
      const from = findTableByName(tables, fromName);
      const to = findTableByName(tables, toName);

      if (!from && !to) {
        return {
          fitTableIds: [],
          phases: [
            {
              tableIds: [],
              activeTableIds: [],
              pulseAddTable: true,
              message: `Add "${fromName}" and "${toName}" tables first.`,
              durationMs: 4000,
            },
          ],
        };
      }
      if (!from || !to) {
        const missing = !from ? fromName : toName;
        return {
          fitTableIds: [from?.id, to?.id].filter(Boolean) as string[],
          phases: [
            {
              tableIds: [from?.id, to?.id].filter(Boolean) as string[],
              activeTableIds: [],
              pulseAddTable: true,
              message: `Add the "${missing}" table from the sidebar first.`,
              durationMs: 4000,
            },
          ],
        };
      }

      if (complete) {
        return {
          fitTableIds: [from.id, to.id],
          phases: [
            {
              tableIds: [from.id, to.id],
              activeTableIds: [from.id, to.id],
              line: { fromTableId: from.id, toTableId: to.id },
              message: `"${from.name}" is linked to "${to.name}".`,
              durationMs: 3000,
            },
          ],
        };
      }

      return {
        fitTableIds: [from.id, to.id],
        phases: [
          {
            tableIds: [from.id],
            activeTableIds: [from.id],
            message: `Start at "${from.name}" — find the FK column (◇) you want to connect.`,
            durationMs: 3000,
          },
          {
            tableIds: [from.id, to.id],
            activeTableIds: [from.id, to.id],
            line: { fromTableId: from.id, toTableId: to.id },
            message: `Drag from a column dot on "${from.name}" toward "${to.name}".`,
            durationMs: 4000,
          },
          {
            tableIds: [to.id],
            activeTableIds: [to.id],
            message: `Release on "${to.name}" (usually its primary key column).`,
            durationMs: 3500,
          },
        ],
      };
    }

    case "manual": {
      const first = tables[0];
      const msg =
        step.instructions?.trim() ||
        step.title ||
        "Follow the instructions in the Playbook step.";
      if (!first) {
        return {
          fitTableIds: [],
          phases: [
            {
              tableIds: [],
              activeTableIds: [],
              pulseAddTable: true,
              message: msg,
              durationMs: 4000,
            },
          ],
        };
      }
      return {
        fitTableIds: [first.id],
        phases: [
          {
            tableIds: [first.id],
            activeTableIds: [first.id],
            message: msg,
            durationMs: 4500,
          },
        ],
      };
    }

    default:
      return null;
  }
}
