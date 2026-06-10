// SWR configuration presets by data type
// Higher frequency for real-time data, lower for static config

export const SWR_DEFAULTS = {
  refreshInterval: 30000,
  dedupingInterval: 2000,
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  errorRetryCount: 3,
};

export const AGENT_SWR_CONFIG = {
  ...SWR_DEFAULTS,
  refreshInterval: 15000,
};

export const AUDIT_SWR_CONFIG = {
  ...SWR_DEFAULTS,
  refreshInterval: 30000,
};

export const POLICY_SWR_CONFIG = {
  ...SWR_DEFAULTS,
  refreshInterval: 60000,
};

export const RUNS_SWR_CONFIG = {
  ...SWR_DEFAULTS,
  refreshInterval: 20000,
};
