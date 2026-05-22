-- Cognivern D1 Database Schema
-- Cloudflare D1 is a serverless SQLite database

-- Agents registry table
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  capabilities TEXT, -- JSON array
  status TEXT DEFAULT 'active',
  policyId TEXT,
  createdAt TEXT NOT NULL,
  lastActive TEXT NOT NULL,
  metadata TEXT -- JSON object
);

-- Governance policies table
CREATE TABLE IF NOT EXISTS policies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  version TEXT NOT NULL,
  rules TEXT, -- JSON array of policy rules
  status TEXT DEFAULT 'draft', -- draft, active, archived
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  createdBy TEXT
);

-- Agent actions audit log
CREATE TABLE IF NOT EXISTS action_logs (
  id TEXT PRIMARY KEY,
  agentId TEXT NOT NULL,
  actionType TEXT NOT NULL,
  actionData TEXT, -- JSON object
  decisionId TEXT,
  approved BOOLEAN,
  reasoning TEXT,
  riskScore INTEGER,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (agentId) REFERENCES agents(id)
);

-- Policy decisions table
CREATE TABLE IF NOT EXISTS policy_decisions (
  id TEXT PRIMARY KEY,
  actionId TEXT NOT NULL,
  agentId TEXT NOT NULL,
  approved BOOLEAN NOT NULL,
  reasoning TEXT,
  decisionType TEXT,
  policyVersion TEXT,
  metadata TEXT, -- JSON object
  timestamp TEXT NOT NULL,
  FOREIGN KEY (agentId) REFERENCES agents(id)
);

-- Agent metrics table (for analytics)
CREATE TABLE IF NOT EXISTS agent_metrics (
  agentId TEXT PRIMARY KEY,
  totalDecisions INTEGER DEFAULT 0,
  approvedActions INTEGER DEFAULT 0,
  rejectedActions INTEGER DEFAULT 0,
  avgDecisionTimeMs REAL DEFAULT 0,
  lastUpdated TEXT NOT NULL,
  FOREIGN KEY (agentId) REFERENCES agents(id)
);

-- Thought history table (cognitive transparency)
CREATE TABLE IF NOT EXISTS thought_history (
  id TEXT PRIMARY KEY,
  agentId TEXT NOT NULL,
  thought TEXT NOT NULL,
  context TEXT, -- JSON object
  timestamp TEXT NOT NULL,
  FOREIGN KEY (agentId) REFERENCES agents(id)
);

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  keyHash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  projectId TEXT,
  permissions TEXT, -- JSON array
  expiresAt TEXT,
  createdAt TEXT NOT NULL,
  lastUsedAt TEXT
);

-- Projects table (multi-tenancy)
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  ownerId TEXT,
  settings TEXT, -- JSON object
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

-- Usage tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  agentId TEXT,
  actionType TEXT,
  tokenCount INTEGER,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (projectId) REFERENCES projects(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_lastActive ON agents(lastActive);
CREATE INDEX IF NOT EXISTS idx_action_logs_agentId ON action_logs(agentId);
CREATE INDEX IF NOT EXISTS idx_action_logs_timestamp ON action_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_policy_decisions_agentId ON policy_decisions(agentId);
CREATE INDEX IF NOT EXISTS idx_thought_history_agentId ON thought_history(agentId);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_projectId ON usage_tracking(projectId);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_timestamp ON usage_tracking(timestamp);

-- Insert default policy
INSERT OR IGNORE INTO policies (id, name, description, version, rules, status, createdAt, updatedAt)
VALUES (
  'default-policy-v1',
  'Default Governance Policy',
  'Standard governance rules for all agents',
  '1.0.0',
  '[{"id": "rule-1", "name": "No Self-Modification", "condition": "action.type !== \"self_modify\"", "action": "deny", "priority": 1}, {"id": "rule-2", "name": "Rate Limit", "condition": "rate < 100/min", "action": "allow", "priority": 2}]',
  'active',
  datetime('now'),
  datetime('now')
);
