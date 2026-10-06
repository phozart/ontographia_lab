/**
 * Rate Limiting Utility for API Routes
 *
 * Simple in-memory rate limiter for Next.js API routes.
 * For production with multiple instances, consider using Redis.
 *
 * Usage:
 *   import { rateLimit, rateLimitMiddleware } from '../lib/rateLimit';
 *
 *   // Option 1: Create a limiter for specific use
 *   const limiter = rateLimit({ interval: 60000, limit: 5 });
 *   export default async function handler(req, res) {
 *     const { success } = await limiter.check(req, res);
 *     if (!success) return;
 *     // ... handle request
 *   }
 *
 *   // Option 2: Use pre-configured middleware
 *   import { authRateLimiter } from '../lib/rateLimit';
 *   export default authRateLimiter(async function handler(req, res) {
 *     // ... handle request
 *   });
 */

// In-memory store for rate limiting
// Note: This resets on server restart and doesn't share between instances
const rateLimitStore = new Map();

// Clean up old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Get client identifier from request.
 *
 * X-Forwarded-For is client-controlled except for the entries appended by our
 * own proxies. TRUST_PROXY_HOPS (default 1) is the number of trusted proxies in
 * front of the app: the entry that many positions from the right is used.
 * With 0, the socket address is used and forwarding headers are ignored.
 * Set TRUST_PROXY_HOPS=1 behind a single reverse proxy (nginx); document it in .env.example.
 */
export function getClientId(req) {
  const raw = parseInt(process.env.TRUST_PROXY_HOPS ?? '1', 10);
  const hops = Number.isInteger(raw) && raw >= 0 ? raw : 1;

  if (hops >= 1) {
    const header = req.headers?.['x-forwarded-for'];
    const forwarded = Array.isArray(header) ? header.join(',') : header;
    if (forwarded) {
      const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
      if (parts.length >= hops) return parts[parts.length - hops];
    }
  }

  const socketAddress = req.socket?.remoteAddress;
  if (socketAddress) {
    return socketAddress;
  }

  // Last resort - not ideal but better than nothing
  return `unknown-${req.headers?.['user-agent']?.slice(0, 50) || 'no-ua'}`;
}

/**
 * Create a rate limiter with custom configuration
 *
 * @param {Object} options
 * @param {number} options.interval - Time window in milliseconds (default: 60000 = 1 minute)
 * @param {number} options.limit - Max requests per interval (default: 10)
 * @param {string} options.prefix - Key prefix for namespacing (default: 'rl')
 */
export function rateLimit({ interval = 60000, limit = 10, prefix = 'rl' } = {}) {
  return {
    /**
     * Check if request is within rate limit
     * @param {Object} req - Next.js request object
     * @param {Object} res - Next.js response object
     * @returns {Object} { success: boolean, remaining: number, resetIn: number }
     */
    async check(req, res, keyOverride) {
      // keyOverride (e.g. an API token id) buckets by something other than the client address
      const clientId = keyOverride ? String(keyOverride) : getClientId(req);
      const key = `${prefix}:${clientId}`;
      const now = Date.now();

      let data = rateLimitStore.get(key);

      // Initialize or reset if expired
      if (!data || now > data.resetTime) {
        data = {
          count: 0,
          resetTime: now + interval,
        };
      }

      // Increment count
      data.count++;
      rateLimitStore.set(key, data);

      const remaining = Math.max(0, limit - data.count);
      const resetIn = Math.max(0, Math.ceil((data.resetTime - now) / 1000));

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(data.resetTime / 1000));

      // Check if over limit
      if (data.count > limit) {
        res.setHeader('Retry-After', resetIn);
        res.status(429).json({
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${resetIn} seconds.`,
          retryAfter: resetIn,
        });
        return { success: false, remaining: 0, resetIn };
      }

      return { success: true, remaining, resetIn };
    },
  };
}

/**
 * Create rate limit middleware wrapper
 *
 * @param {Function} handler - The API route handler
 * @param {Object} options - Rate limit options
 */
export function rateLimitMiddleware(handler, options = {}) {
  const limiter = rateLimit(options);

  return async (req, res) => {
    const { success } = await limiter.check(req, res);
    if (!success) return;
    return handler(req, res);
  };
}

// Pre-configured limiters for common use cases

/**
 * Auth rate limiter - Strict limits for login/signup
 * 5 attempts per minute per IP
 */
export const authLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  limit: 5,
  prefix: 'auth',
});

/**
 * Auth rate limiter middleware wrapper
 */
export function authRateLimiter(handler) {
  return rateLimitMiddleware(handler, {
    interval: 60 * 1000,
    limit: 5,
    prefix: 'auth',
  });
}

/**
 * API rate limiter - General API endpoints
 * 60 requests per minute per IP
 */
export const apiLimiter = rateLimit({
  interval: 60 * 1000,
  limit: 60,
  prefix: 'api',
});

/**
 * API rate limiter middleware wrapper
 */
export function apiRateLimiter(handler) {
  return rateLimitMiddleware(handler, {
    interval: 60 * 1000,
    limit: 60,
    prefix: 'api',
  });
}

/**
 * Strict rate limiter - For sensitive operations like password reset
 * 3 attempts per 15 minutes per IP
 */
export const strictLimiter = rateLimit({
  interval: 15 * 60 * 1000, // 15 minutes
  limit: 3,
  prefix: 'strict',
});

/**
 * Strict rate limiter middleware wrapper
 */
export function strictRateLimiter(handler) {
  return rateLimitMiddleware(handler, {
    interval: 15 * 60 * 1000,
    limit: 3,
    prefix: 'strict',
  });
}

export default rateLimit;
