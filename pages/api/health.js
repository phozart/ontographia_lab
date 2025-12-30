// pages/api/health.js
// Health check endpoint for container orchestration and monitoring

import { query } from '../../lib/db';

export default async function handler(req, res) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    app: 'Ontographia Lab',
    version: process.env.npm_package_version || '1.0.0',
    checks: {},
  };

  // Check database connectivity
  try {
    const start = Date.now();
    await query('SELECT 1');
    const latency = Date.now() - start;
    health.checks.database = {
      status: 'healthy',
      latency: `${latency}ms`,
    };
  } catch (error) {
    health.status = 'unhealthy';
    health.checks.database = {
      status: 'unhealthy',
      error: error.message,
    };
  }

  // Check memory usage
  const memUsage = process.memoryUsage();
  health.checks.memory = {
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
  };

  // Return appropriate status code
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
}
