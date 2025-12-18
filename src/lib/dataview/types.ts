// Dataview Query AST Types
// Compatible with Obsidian Dataview syntax

export type QueryType = "TABLE" | "LIST" | "TASK";

export type SortDirection = "ASC" | "DESC";

export type ComparisonOperator = "=" | "!=" | ">" | "<" | ">=" | "<=" | "CONTAINS" | "STARTSWITH" | "ENDSWITH";

export type LogicalOperator = "AND" | "OR";

// Field reference (e.g., file.name, status, frontmatter.priority)
export interface FieldReference {
  type: "field";
  path: string[]; // e.g., ["file", "name"] or ["status"]
}

// Literal value
export interface LiteralValue {
  type: "literal";
  value: string | number | boolean | null;
}

export type ValueExpression = FieldReference | LiteralValue;

// Comparison condition (e.g., status = "active")
export interface ComparisonCondition {
  type: "comparison";
  left: FieldReference;
  operator: ComparisonOperator;
  right: ValueExpression;
}

// Logical condition (AND/OR)
export interface LogicalCondition {
  type: "logical";
  operator: LogicalOperator;
  conditions: Condition[];
}

// Negation condition (NOT)
export interface NegationCondition {
  type: "negation";
  condition: Condition;
}

export type Condition = ComparisonCondition | LogicalCondition | NegationCondition;

// FROM clause source
export interface FromSource {
  type: "folder" | "tag" | "link" | "outgoing";
  value: string; // folder path, tag name, or note reference
}

// SORT clause
export interface SortClause {
  field: FieldReference;
  direction: SortDirection;
}

// GROUP BY clause
export interface GroupByClause {
  field: FieldReference;
}

// Complete Dataview Query
export interface DataviewQuery {
  queryType: QueryType;
  fields: FieldReference[]; // For TABLE queries
  from?: FromSource[];
  where?: Condition;
  sort?: SortClause[];
  groupBy?: GroupByClause;
  limit?: number;
  flatten?: FieldReference;
}

// Query execution result
export interface DataviewResult {
  type: QueryType;
  columns?: string[]; // For TABLE
  rows: DataviewRow[];
  error?: string;
  executionTime?: number;
}

export interface DataviewRow {
  path: string;
  title: string;
  values: Record<string, unknown>;
}

// Serialized query for backend
export interface SerializedQuery {
  query_type: string;
  fields: string[];
  from_sources: Array<{ source_type: string; value: string }>;
  where_clause?: SerializedCondition;
  sort_clauses: Array<{ field: string; direction: string }>;
  group_by?: string;
  limit?: number;
}

export interface SerializedCondition {
  condition_type: string;
  field?: string;
  operator?: string;
  value?: string | number | boolean | null;
  conditions?: SerializedCondition[];
}

// Helper to serialize query for backend
export function serializeQuery(query: DataviewQuery): SerializedQuery {
  return {
    query_type: query.queryType,
    fields: query.fields.map(f => f.path.join(".")),
    from_sources: (query.from || []).map(s => ({
      source_type: s.type,
      value: s.value,
    })),
    where_clause: query.where ? serializeCondition(query.where) : undefined,
    sort_clauses: (query.sort || []).map(s => ({
      field: s.field.path.join("."),
      direction: s.direction,
    })),
    group_by: query.groupBy?.field.path.join("."),
    limit: query.limit,
  };
}

function serializeCondition(condition: Condition): SerializedCondition {
  switch (condition.type) {
    case "comparison":
      return {
        condition_type: "comparison",
        field: condition.left.path.join("."),
        operator: condition.operator,
        value: condition.right.type === "literal" ? condition.right.value : condition.right.path.join("."),
      };
    case "logical":
      return {
        condition_type: condition.operator.toLowerCase(),
        conditions: condition.conditions.map(serializeCondition),
      };
    case "negation":
      return {
        condition_type: "not",
        conditions: [serializeCondition(condition.condition)],
      };
  }
}
