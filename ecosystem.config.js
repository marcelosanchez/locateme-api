const path = require('path');

module.exports = {
  apps: [
    {
      name: 'locateme-api',                           // PM2 app name
      script: './server.js',                          // Main file
      instances: 1,                                   // Single instance (fork mode)
      autorestart: true,                              // Restart on failure
      watch: false,                                   // Disable watch in production
      max_memory_restart: '200M',                     // Restart if over 200MB
      env: {
        NODE_ENV: 'development',                      // Environment variables
        PORT: 3001,                                   // API port
      },
      error_file: process.env.ERROR_LOG_PATH || path.resolve(__dirname, 'logs', 'error.log'),
      out_file: process.env.OUT_LOG_PATH || path.resolve(__dirname, 'logs', 'out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',         // Log date format
    }
  ]
};
