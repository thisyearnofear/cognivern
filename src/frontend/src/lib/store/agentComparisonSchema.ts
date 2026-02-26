/**
 * Agent Comparison Filter Schema
 * Inspired by OpenStatus data-table-filters pattern
 * Single source of truth for agent comparison filters
 */

// Simple field builders (no external dependencies for now)
export interface FilterField<T> {
  type: string;
  defaultValue: T;
  parse: (value: string | null) => T;
  serialize: (value: T) => string | null;
}

// Field builders
export const field = {
  string: (): FilterField<string | null> => ({
    type: "string",
    defaultValue: null,
    parse: (value) => value || null,
    serialize: (value) => value || null,
  }),

  number: (): FilterField<number | null> => ({
    type: "number",
    defaultValue: null,
    parse: (value) => (value ? parseInt(value, 10) : null),
    serialize: (value) => (value !== null ? value.toString() : null),
  }),

  boolean: (): FilterField<boolean> => ({
    type: "boolean",
    defaultValue: false,
    parse: (value) => value === "true",
    serialize: (value) => (value ? "true" : "false"),
  }),

  array: <T>(
    innerField: FilterField<T>,
    delimiter = ",",
  ): FilterField<T[]> => ({
    type: "array",
    defaultValue: [],
    parse: (value) => {
      if (!value) return [];
      return value
        .split(delimiter)
        .map((v) => innerField.parse(v))
        .filter((v) => v !== null) as T[];
    },
    serialize: (value) => {
      if (!value || value.length === 0) return null;
      return value
        .map((v) => innerField.serialize(v as any))
        .filter(Boolean)
        .join(delimiter);
    },
  }),

  stringLiteral: <T extends string>(literals: T[]): FilterField<T | null> => ({
    type: "stringLiteral",
    defaultValue: null,
    parse: (value) => {
      if (!value || !literals.includes(value as T)) return null;
      return value as T;
    },
    serialize: (value) => value || null,
  }),

  range: (delimiter = "-"): FilterField<[number, number] | null> => ({
    type: "range",
    defaultValue: null,
    parse: (value) => {
      if (!value) return null;
      const parts = value.split(delimiter).map((v) => parseInt(v, 10));
      if (parts.length !== 2 || parts.some(isNaN)) return null;
      return [parts[0], parts[1]] as [number, number];
    },
    serialize: (value) => {
      if (!value) return null;
      return `${value[0]}${delimiter}${value[1]}`;
    },
  }),

  timestamp: (): FilterField<Date | null> => ({
    type: "timestamp",
    defaultValue: null,
    parse: (value) => {
      if (!value) return null;
      const timestamp = parseInt(value, 10);
      return isNaN(timestamp) ? null : new Date(timestamp);
    },
    serialize: (value) => (value ? value.getTime().toString() : null),
  }),
};

// Agent comparison filter schema
export const agentComparisonSchema = {
  // Agent selection
  agentIds: field.array(field.string()),
  agentTypes: field.array(
    field.stringLiteral(["recall", "vincent", "sapience", "custom"]),
  ),
  ecosystems: field.array(
    field.stringLiteral(["sapience", "polymarket", "manifold", "other"]),
  ),
  status: field.array(
    field.stringLiteral(["active", "inactive", "paused", "error"]),
  ),

  // Performance & Governance filters (ranges)
  winRate: field.range(), // [min, max] percentage
  totalReturn: field.range(), // [min, max] return
  complianceScore: field.range(), // [min, max] percentage
  autonomyLevel: field.range(), // [min, max] level (1-5)
  riskProfile: field.array(
    field.stringLiteral(["low", "medium", "high", "critical"]),
  ),
  sharpeRatio: field.range(), // [min, max] sharpe
  avgLatency: field.range(), // [min, max] ms

  // Time range
  timeRange: field.array(field.timestamp(), "-"), // [start, end]

  // Sorting
  sortBy: field.stringLiteral([
    "winRate",
    "totalReturn",
    "complianceScore",
    "autonomyLevel",
    "sharpeRatio",
    "totalTrades",
    "avgLatency",
    "agentName",
  ]),
  sortDirection: field.stringLiteral(["asc", "desc"]),

  // Search
  search: field.string(),

  // View mode
  viewMode: field.stringLiteral(["table", "cards", "chart"]),
} as const;

export type AgentComparisonFilters = {
  [K in keyof typeof agentComparisonSchema]: ReturnType<
    (typeof agentComparisonSchema)[K]["parse"]
  >;
};

// Default filter values
export const defaultFilters: AgentComparisonFilters = Object.entries(
  agentComparisonSchema,
).reduce(
  (acc, [key, field]) => ({
    ...acc,
    [key]: field.defaultValue,
  }),
  {} as AgentComparisonFilters,
);

// Filter field definitions for UI rendering
export interface FilterFieldDefinition {
  key: keyof AgentComparisonFilters;
  label: string;
  type: "checkbox" | "slider" | "timerange" | "input" | "select";
  options?: Array<{ label: string; value: string | number }>;
  min?: number;
  max?: number;
  placeholder?: string;
}

export const filterFieldDefinitions: FilterFieldDefinition[] = [
  {
    key: "agentTypes",
    label: "Agent Type",
    type: "checkbox",
    options: [
      { label: "Recall", value: "recall" },
      { label: "Vincent", value: "vincent" },
      { label: "Sapience", value: "sapience" },
      { label: "Custom", value: "custom" },
    ],
  },
  {
    key: "ecosystems",
    label: "Ecosystem",
    type: "checkbox",
    options: [
      { label: "Sapience", value: "sapience" },
      { label: "Polymarket", value: "polymarket" },
      { label: "Manifold", value: "manifold" },
      { label: "Other", value: "other" },
    ],
  },
  {
    key: "status",
    label: "Status",
    type: "checkbox",
    options: [
      { label: "Active", value: "active" },
      { label: "Inactive", value: "inactive" },
      { label: "Paused", value: "paused" },
      { label: "Error", value: "error" },
    ],
  },
  {
    key: "complianceScore",
    label: "Compliance Score (%)",
    type: "slider",
    min: 0,
    max: 100,
  },
  {
    key: "autonomyLevel",
    label: "Autonomy Level",
    type: "slider",
    min: 1,
    max: 5,
  },
  {
    key: "riskProfile",
    label: "Risk Profile",
    type: "checkbox",
    options: [
      { label: "Low", value: "low" },
      { label: "Medium", value: "medium" },
      { label: "High", value: "high" },
      { label: "Critical", value: "critical" },
    ],
  },
  {
    key: "winRate",
    label: "Win Rate (%)",
    type: "slider",
    min: 0,
    max: 100,
  },
  {
    key: "totalReturn",
    label: "Total Return",
    type: "slider",
    min: -100,
    max: 100,
  },
  {
    key: "sharpeRatio",
    label: "Sharpe Ratio",
    type: "slider",
    min: -3,
    max: 3,
  },
  {
    key: "search",
    label: "Search",
    type: "input",
    placeholder: "Search agents...",
  },
];
