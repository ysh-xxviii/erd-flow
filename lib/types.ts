// Shared domain types for the ERD Builder.

export type AccentColor =
  | "blue"
  | "purple"
  | "orange"
  | "green"
  | "pink";

export const ACCENT_HEX: Record<AccentColor, string> = {
  blue: "#5aa6ff",
  purple: "#8b7bff",
  orange: "#ef8a52",
  green: "#1bb38c",
  pink: "#e766a0",
};

// Semantic colors lifted from the reference schema design.
export const SCHEMA_COLORS = {
  pk: "#e3b341", // primary key (gold)
  fk: "#5aa6ff", // foreign key (blue)
  type: "#58c2bd", // data type (teal)
  cardBg: "#131a2b",
  cardBorder: "#25304a",
  edge: "#5aa6ff",
  edgeMuted: "#566f8c",
} as const;

export const ACCENT_ORDER: AccentColor[] = [
  "blue",
  "purple",
  "orange",
  "green",
  "pink",
];

export type TableCategory = "core" | "framework" | "enum";

export const FRAMEWORK_HEX = "#51607f";
export const ENUM_HEX = "#a78bff";

// Display color for a table: framework -> gray, enum -> purple, else its accent.
export function tableColorHex(t: {
  color: AccentColor;
  category: TableCategory;
}): string {
  if (t.category === "framework") return FRAMEWORK_HEX;
  if (t.category === "enum") return ENUM_HEX;
  return ACCENT_HEX[t.color];
}

export function categoryTag(category: TableCategory): string {
  if (category === "framework") return "infra";
  if (category === "enum") return "enum";
  return "table";
}

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface Diagram {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ErdColumn {
  id: string;
  table_id: string;
  name: string;
  data_type: string;
  is_pk: boolean;
  is_fk: boolean;
  is_nullable: boolean;
  ordinal: number;
  default_value: string | null;
  label: string | null;
  json_description: string | null;
  json_schema: string | null;
}

export type ErdConstraintKind = "unique" | "index";

export interface ErdConstraint {
  kind: ErdConstraintKind;
  columns: string[];
}

export interface ErdTable {
  id: string;
  diagram_id: string;
  name: string;
  color: AccentColor;
  category: TableCategory;
  description: string;
  constraints: ErdConstraint[];
  pos_x: number;
  pos_y: number;
  columns: ErdColumn[];
}

export type Cardinality = "one-to-one" | "one-to-many" | "many-to-many";

export interface ErdRelationship {
  id: string;
  diagram_id: string;
  source_table_id: string;
  source_col_id: string | null;
  target_table_id: string;
  target_col_id: string | null;
  cardinality: Cardinality;
}

// The full schema payload exchanged with the AI suggestion route and the canvas.
export interface SchemaSnapshot {
  tables: {
    name: string;
    columns: { name: string; data_type: string; is_pk: boolean; is_fk: boolean }[];
  }[];
}

// Shape returned by the AI suggestion endpoint.
export interface SuggestedColumn {
  name: string;
  data_type: string;
  is_pk?: boolean;
  is_fk?: boolean;
  is_nullable?: boolean;
  default_value?: string | null;
  label?: string | null;
  json_description?: string | null;
  json_schema?: string | null;
}

export interface SuggestedTable {
  name: string;
  category?: TableCategory;
  reason: string;
  description?: string;
  columns: SuggestedColumn[];
  constraints?: ErdConstraint[];
  relationships?: {
    to_table: string;
    from_column: string;
    cardinality: Cardinality;
  }[];
}

export interface SuggestResponse {
  suggestions: SuggestedTable[];
}

export type WorkspaceRole = "owner" | "member";

export type PlaybookCheckType =
  | "manual"
  | "table_exists"
  | "column_exists"
  | "relationship_exists";

export interface PlaybookCriteria {
  table?: string;
  column?: string;
  from_table?: string;
  to_table?: string;
}

export interface PlaybookStep {
  id: string;
  diagram_id: string;
  ordinal: number;
  title: string;
  instructions: string;
  check_type: PlaybookCheckType;
  criteria: PlaybookCriteria;
  is_done: boolean;
  done_at: string | null;
  done_by: string | null;
  created_at: string;
}

export type PlaybookStepStatus = "pending" | "done" | "auto_verified";

export interface PlaybookStepEval {
  step: PlaybookStep;
  status: PlaybookStepStatus;
}

export interface WorkspaceMemberInfo {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: WorkspaceRole;
  created_at: string;
}

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  invited_by: string | null;
  accepted_at: string | null;
  created_at: string;
}

export interface DiagramComment {
  id: string;
  diagram_id: string;
  table_id: string | null;
  column_id: string | null;
  author_id: string | null;
  author_name?: string | null;
  body: string;
  resolved: boolean;
  created_at: string;
}
