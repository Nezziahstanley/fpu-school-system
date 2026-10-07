// ============================================================
// FPU School Management System — PM2 configuration
// ------------------------------------------------------------
// Uses fork mode (single instance) — no cluster mode because
// the app is not stateless across workers and Render free tier
// gives us one process anyway.
// Usage:
//   pm2 start ecosystem.config.js
//   pm2 logs fpu-school-system
//   pm2 restart fpu-school-system
// ============================================================

module.exports = {
  apps: [
    {
      name: 'fpu-school-system',
      script: './server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '350M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000,
      listen_timeout: 5000,
      wait_ready: false,
    },
  ],
};