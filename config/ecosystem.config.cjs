module.exports = {
  apps: [
    {
      name: 'cognivern-backend',
      script: 'dist/index.js',
      cwd: '/opt/cognivern',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      kill_timeout: 5000,
      listen_timeout: 10000,
      node_args: '-r dotenv/config',
      env: {
        NODE_ENV: 'production',
        PORT: 10000,
        LOG_LEVEL: 'info',
        DOTENV_CONFIG_PATH: '/etc/cognivern.env',
      },
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true,
      max_size: '10M',
    }
  ],
};
