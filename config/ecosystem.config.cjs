module.exports = {
  apps: [
    {
      name: 'cognivern-backend',
      script: 'dist/src/index.js',
      cwd: '/opt/cognivern/app',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      kill_timeout: 5000,
      listen_timeout: 10000,
      node_args: '-r dotenv/config --loader /opt/cognivern/app/config/esm-dir-loader.mjs',
      env: {
        NODE_ENV: 'production',
        // PORT comes from /opt/cognivern/shared/.env (3087) via dotenv.
        // Do NOT set PORT here — PM2 env vars override dotenv, which caused
        // a recurring 502 (app on 10000, nginx proxying to 3087).
        LOG_LEVEL: 'info',
        DOTENV_CONFIG_PATH: '/opt/cognivern/shared/.env',
        CRE_RUNS_FILE: '/opt/cognivern/shared/data/cre-runs.jsonl',
        UX_EVENTS_FILE: '/opt/cognivern/shared/data/ux-events.jsonl',
        IDEMPOTENCY_STORE_FILE: '/opt/cognivern/shared/data/idempotency-store.json',
        RATE_LIMIT_STORE_FILE: '/opt/cognivern/shared/data/rate-limit-store.jsonl',
        TOKEN_BLACKLIST_FILE: '/opt/cognivern/shared/data/token-blacklist.jsonl',
        OWS_VAULT_PATH: '/opt/cognivern/shared/data/ows-vault.json',
        COGNIVERN_TOKEN_TELEMETRY_FILE: '/opt/cognivern/shared/data/token-telemetry.json',
        COGNIVERN_USAGE_FILE: '/opt/cognivern/shared/data/usage.json',
      },
      log_file: '/opt/cognivern/shared/logs/combined.log',
      out_file: '/opt/cognivern/shared/logs/out.log',
      error_file: '/opt/cognivern/shared/logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true,
      max_size: '10M',
    },
  ],
};
