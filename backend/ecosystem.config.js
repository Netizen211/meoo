// PM2 进程管理配置
// 部署后运行: pm2 start ecosystem.config.js --env production
// 保存自启: pm2 save && pm2 startup

module.exports = {
  apps: [
    {
      name: 'meoo-server',
      cwd: '/www/wwwroot/meoo/server',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: '3007',
      },
      max_memory_restart: '300M',
      watch: false,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/var/log/meoo-server-error.log',
      out_file: '/var/log/meoo-server-out.log',
      merge_logs: true,
      kill_timeout: 10000,
      listen_timeout: 5000,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
      exp_backoff_restart_delay: 1000,
    },
  ],
};
