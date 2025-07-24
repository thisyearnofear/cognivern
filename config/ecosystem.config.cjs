module.exports = {
  apps: [
    {
      name: "cognivern-api",
      script: "dist/index.js",
      cwd: "/opt/cognivern",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        API_KEY: "showcase-api-key",
        LOG_LEVEL: "info",

        // Database Configuration
        POSTGRES_PASSWORD: "cognivern",
        DATABASE_URL:
          "postgresql://postgres:cognivern@localhost:5432/cognivern",
        REDIS_URL: "redis://localhost:6379",

        // Trading Agent API Keys (Production)
        RECALL_API_KEY_DIRECT: "52afa13c30857147_78db8aed694cc70a",
        RECALL_API_KEY_VINCENT: "4fddb4bf32752f24_9a39cd26a7cda63e",

        // Wallet Configuration
        WALLET_ADDRESS: "0x8502d079f93AEcdaC7B0Fe71Fa877721995f1901",

        // Blockchain Configuration
        ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY || "your_alchemy_api_key",
        GOVERNANCE_CONTRACT_ADDRESS:
          "0x1234567890123456789012345678901234567890",
        STORAGE_CONTRACT_ADDRESS: "0x1234567890123456789012345678901234567890",

        // AI Configuration
        OPENAI_API_KEY: "placeholder",

        // Monitoring Configuration
        HEALTH_CHECK_INTERVAL: 30000,

        // Trading Configuration
        TRADING_ENABLED: true,
        MIN_TRADES_PER_DAY: 144,
        TRADE_INTERVAL_MINUTES: 10,
        MAX_RISK_PER_TRADE: 0.01,
      },
      log_file: "./logs/cognivern-combined.log",
      out_file: "./logs/cognivern-out.log",
      error_file: "./logs/cognivern-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      time: true,
    },
  ],
};
