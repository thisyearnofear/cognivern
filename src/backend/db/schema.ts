// Cognivern Drizzle Schema
// Defines the database schema using Drizzle ORM for type-safe queries and migrations.
// Tables reflect the actual database structure created by db/index.ts migrate().

import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ── Users ──────────────────────────────────────────────────────────────────
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    walletAddress: text("wallet_address").unique(),
    email: text("email").unique(),
    passwordHash: text("password_hash"),
    emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
    verificationToken: text("verification_token"),
    resetToken: text("reset_token"),
    resetTokenExpiresAt: text("reset_token_expires_at"),
    authMethod: text("auth_method").notNull().default("wallet"),
    createdAt: text("created_at").notNull(),
    lastLoginAt: text("last_login_at").notNull(),
  },
  (table) => [
    index("idx_users_wallet").on(table.walletAddress),
  ],
);

// ── Workspaces ─────────────────────────────────────────────────────────────
export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    ownerId: text("owner_id").notNull(),
    tier: text("tier").notNull().default("demo"),
    settings: text("settings"), // JSON object
    activatedAt: text("activated_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_workspaces_owner").on(table.ownerId),
  ],
);

// ── Nonces (SIWE / wallet auth) ─────────────────────────────────────────────
export const nonces = sqliteTable(
  "nonces",
  {
    nonce: text("nonce").primaryKey(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [
    index("idx_nonces_expires").on(table.expiresAt),
  ],
);

// ── API Keys ────────────────────────────────────────────────────────────────
export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    keyPrefix: text("key_prefix").notNull(),
    scopes: text("scopes").notNull().default("[]"),
    lastUsedAt: text("last_used_at"),
    createdAt: text("created_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    index("idx_api_keys_workspace").on(table.workspaceId),
  ],
);


// ── Workspace Agents ────────────────────────────────────────────────────────
export const workspaceAgents = sqliteTable(
  "workspace_agents",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull().default("active"),
    chain: text("chain").notNull(),
    walletAddress: text("wallet_address"),
    budget: text("budget"),
    trades: integer("trades").notNull().default(0),
    spendHistory: text("spend_history").notNull().default("[]"),
    source: text("source").notNull().default("managed"),
    webhookUrl: text("webhook_url"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_workspace_agents_workspace").on(table.workspaceId),
  ],
);

// ── Workspace Policies ─────────────────────────────────────────────────────
export const workspacePolicies = sqliteTable(
  "workspace_policies",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("active"),
    rules: text("rules").notNull().default("[]"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_workspace_policies_workspace").on(table.workspaceId),
  ],
);

// ── Funded Mandates ─────────────────────────────────────────────────────────
export const fundedMandates = sqliteTable(
  "funded_mandates",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    name: text("name").notNull(),
    objective: text("objective").notNull(),
    agentIds: text("agent_ids").notNull().default("[]"),
    status: text("status").notNull().default("draft"),
    budgetByAsset: text("budget_by_asset").notNull().default("{}"),
    policyIds: text("policy_ids").notNull().default("[]"),
    measurementWindow: text("measurement_window"),
    successMetrics: text("success_metrics").notNull().default("[]"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_funded_mandates_workspace").on(table.workspaceId)],
);

// ── Outcome Observations ────────────────────────────────────────────────────
export const outcomeObservations = sqliteTable(
  "outcome_observations",
  {
    id: text("id").primaryKey(),
    mandateId: text("mandate_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    metricId: text("metric_id"),
    kind: text("kind").notNull(),
    value: text("value").notNull(),
    unit: text("unit").notNull(),
    observedAt: text("observed_at").notNull(),
    source: text("source").notNull(),
    confidence: text("confidence").notNull(),
    evidence: text("evidence").notNull().default("[]"),
    notes: text("notes"),
    idempotencyKey: text("idempotency_key").notNull(),
    payloadHash: text("payload_hash").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_outcome_observations_mandate").on(table.workspaceId, table.mandateId, table.observedAt),
    uniqueIndex("outcome_observations_idempotency_unique").on(table.workspaceId, table.mandateId, table.idempotencyKey),
  ],
);

// ── Published Mandate Statements ───────────────────────────────────────────
export const publishedMandateStatements = sqliteTable(
  "published_mandate_statements",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    mandateId: text("mandate_id").notNull(),
    version: integer("version").notNull(),
    payload: text("payload").notNull(),
    contentHash: text("content_hash").notNull(),
    publishedBy: text("published_by").notNull(),
    publishedAt: text("published_at").notNull(),
  },
  (table) => [
    uniqueIndex("published_statements_version_unique").on(table.workspaceId, table.mandateId, table.version),
    index("idx_published_statements_mandate").on(table.workspaceId, table.mandateId),
  ],
);

// ── Policy Versions ────────────────────────────────────────────────────────
export const policyVersions = sqliteTable(
  "policy_versions",
  {
    id: text("id").primaryKey(),
    policyId: text("policy_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    version: integer("version").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("active"),
    rules: text("rules").notNull().default("[]"),
    snapshotAt: text("snapshot_at").notNull(),
  },
  (table) => [
    index("idx_policy_versions_policy").on(table.policyId),
  ],
);

// ── Workspace Members ──────────────────────────────────────────────────────
export const workspaceMembers = sqliteTable(
  "workspace_members",
  {
    workspaceId: text("workspace_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").notNull().default("owner"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.workspaceId, table.userId] }),
  }),
);

// ── Notifications ──────────────────────────────────────────────────────────
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    agentId: text("agent_id"),
    event: text("event").notNull(),
    payload: text("payload").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_notifications_workspace").on(table.workspaceId),
    index("idx_notifications_created").on(table.createdAt),
  ],
);

// ── Type helpers ───────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type Nonce = typeof nonces.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type WorkspaceAgent = typeof workspaceAgents.$inferSelect;
export type NewWorkspaceAgent = typeof workspaceAgents.$inferInsert;
export type WorkspacePolicy = typeof workspacePolicies.$inferSelect;
export type NewWorkspacePolicy = typeof workspacePolicies.$inferInsert;
export type FundedMandate = typeof fundedMandates.$inferSelect;
export type NewFundedMandate = typeof fundedMandates.$inferInsert;
export type OutcomeObservation = typeof outcomeObservations.$inferSelect;
export type NewOutcomeObservation = typeof outcomeObservations.$inferInsert;
export type PublishedMandateStatementRow = typeof publishedMandateStatements.$inferSelect;
export type NewPublishedMandateStatementRow = typeof publishedMandateStatements.$inferInsert;
export type PolicyVersion = typeof policyVersions.$inferSelect;
export type NewPolicyVersion = typeof policyVersions.$inferInsert;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
