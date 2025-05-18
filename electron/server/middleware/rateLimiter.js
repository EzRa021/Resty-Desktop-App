import fastifyRateLimit from '@fastify/rate-limit';
import { securityMonitor } from '../utils/securityMonitor.js';

// Create a store to track IP addresses and their request counts
const limiterStore = new Map();

// Configure rate limiter options
const createRateLimiter = (options = {}) => {
  const defaultOptions = {
    timeWindow: 15 * 60 * 1000, // 15 minutes by default
    max: 100, // Limit each IP to 100 requests per timeWindow
    errorResponseBuilder: (req, context) => {
      securityMonitor.logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        ip: req.ip,
        path: req.url,
        timestamp: new Date()
      });
      return {
        code: 429,
        error: 'Too Many Requests',
        message: 'Too many requests from this IP, please try again later',
        expiresIn: Math.ceil(context.after / 1000)
      };
    }
  };
  return async (fastify) => {    await fastify.register(fastifyRateLimit, {
      ...defaultOptions,
      ...options,
      store: limiterStore,
      keyGenerator: (req) => req.ip
    });
  };
};

// Create different rate limiters for different routes
const authLimiter = createRateLimiter({
  timeWindow: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  errorResponseBuilder: (req, context) => ({
    code: 429,
    error: 'Too Many Requests',
    message: 'Too many login attempts, please try again later',
    expiresIn: Math.ceil(context.after / 1000)
  })
});

const apiLimiter = createRateLimiter({
  timeWindow: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  allowList: ['127.0.0.1', 'localhost'] // Allow local development
});

export {
  authLimiter,
  apiLimiter,
  createRateLimiter
};
