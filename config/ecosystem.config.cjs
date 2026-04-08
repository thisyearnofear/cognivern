module.exports = {
  apps: [
    {
      name: 'cognivern',
      script: 'dist/index.js',
      cwd: '/opt/cognivern',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 10000,
        LOG_LEVEL: 'info'
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
