import express from 'express';
import { auditLogger } from './utils/auditLogger.js';
import { securityMonitor } from './utils/securityMonitor.js';
import SocketSecurityMiddleware from './middleware/socketSecurity.js';

function setupSecurity(app, io) {
  // Set up basic security headers
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
    });
    next();
  });

  // Add audit logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    
    // Log when the response is finished
    res.on('finish', () => {
      auditLogger.logSystemEvent('HTTP_REQUEST', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: Date.now() - start,
        ip: req.ip
      });
    });

    next();
  });

  // Security monitoring middleware
  app.use((req, res, next) => {
    if (securityMonitor.isIPBlocked(req.ip)) {
      auditLogger.logSecurityEvent('BLOCKED_IP_ATTEMPT', {
        ip: req.ip,
        path: req.path
      });
      return res.status(403).json({ error: 'Access denied' });
    }

    if (securityMonitor.isIPSuspicious(req.ip)) {
      auditLogger.logSecurityEvent('SUSPICIOUS_IP_ACCESS', {
        ip: req.ip,
        path: req.path
      });
    }

    next();
  });

  // Set up Socket.IO security
  const socketSecurity = new SocketSecurityMiddleware(io);

  // Clean up security monitor periodically
  setInterval(() => {
    securityMonitor.cleanup();
  }, 3600000); // Every hour

  return {
    socketSecurity
  };
}

export default setupSecurity;
