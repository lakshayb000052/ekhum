import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import pool from '../config/db';

/**
 * Enterprise Security Middleware Suite for EKhum / DanaPro
 * Enforces HTTP Defense Headers, Anti-SSRF guards, Webhook HMAC signatures, and Sliding Rate Limits.
 */

// 1. Strict HTTP Security Defense Headers Middleware
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  // Prevent MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent Clickjacking (allow only same origin iframe embeddings)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Enforce HSTS (Strict-Transport-Security) for 1 year with subdomains and preload
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // XSS Protection legacy fallback
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Permissions Policy (Disable dangerous hardware APIs)
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com")');

  // Content Security Policy (Allow trusted checkout scripts and CDN)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com; img-src 'self' data: https:; connect-src 'self' wss: https:;"
  );

  next();
}

// 2. Anti-SSRF (Server-Side Request Forgery) Safe URL Validator
// Blocks private IP ranges, loopback, and cloud instance metadata services (169.254.169.254)
export function validateSafeExternalUrl(urlStr: string): { isValid: boolean; reason?: string } {
  try {
    const parsed = new URL(urlStr);

    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { isValid: false, reason: 'Only HTTP and HTTPS protocols are allowed.' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check for localhost / loopback
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.startsWith('127.')
    ) {
      return { isValid: false, reason: 'Loopback and localhost destinations are prohibited.' };
    }

    // Check for Cloud Metadata endpoints
    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
      return { isValid: false, reason: 'Cloud metadata service access is prohibited.' };
    }

    // Check for RFC-1918 Private IPv4 ranges:
    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 100.64.0.0/10 (CGNAT)
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);
    if (match) {
      const b0 = parseInt(match[1], 10);
      const b1 = parseInt(match[2], 10);

      if (
        b0 === 10 || // 10.0.0.0/8
        (b0 === 172 && b1 >= 16 && b1 <= 31) || // 172.16.0.0/12
        (b0 === 192 && b1 === 168) || // 192.168.0.0/16
        (b0 === 100 && b1 >= 64 && b1 <= 127) || // 100.64.0.0/10
        b0 === 0 // 0.0.0.0/8
      ) {
        return { isValid: false, reason: 'Internal and private RFC-1918 IP addresses are blocked.' };
      }
    }

    return { isValid: true };
  } catch (err) {
    return { isValid: false, reason: 'Malformed URL format.' };
  }
}

// 3. Webhook HMAC Signature Verification Helper
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  receivedSignature: string,
  secretKey: string,
  algorithm: 'sha256' | 'sha512' = 'sha256'
): boolean {
  if (!rawBody || !receivedSignature || !secretKey) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac(algorithm, secretKey)
      .update(rawBody)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const receivedBuf = Buffer.from(receivedSignature, 'utf8');

    if (expectedBuf.length !== receivedBuf.length) {
      return false;
    }

    // Timing-safe comparison to prevent side-channel timing attacks
    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  } catch (err) {
    console.error('Webhook signature verification error:', err);
    return false;
  }
}

// 4. In-Memory Sliding Window Rate Limiter (Fallback when Redis is cold)
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const ipBuckets = new Map<string, RateLimitBucket>();

// Cleanup stale buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of ipBuckets.entries()) {
    if (bucket.resetAt <= now) {
      ipBuckets.delete(ip);
    }
  }
}, 5 * 60 * 1000);

export function createRateLimiter(options: { maxRequests: number; windowMs: number; message?: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const bucket = ipBuckets.get(ip);
    if (!bucket || bucket.resetAt <= now) {
      ipBuckets.set(ip, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > options.maxRequests) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      return res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: options.message || 'Too many requests. Please slow down.',
          retry_after_seconds: retryAfter,
        },
      });
    }

    next();
  };
}

// 5. Immutable Audit Logger Helper
export async function logAuditEvent(params: {
  userId?: string | null;
  userType: 'superadmin' | 'ngo_admin' | 'donor' | 'system' | 'api_key';
  action: string;
  details: Record<string, any>;
  ipAddress?: string | null;
}) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_type, action, details, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [
        params.userId || null,
        params.userType,
        params.action,
        JSON.stringify(params.details),
        params.ipAddress || null,
      ]
    );
  } catch (err) {
    // Log to console if audit log write fails, but never crash calling thread
    console.error('CRITICAL: Failed to write to audit_logs table:', err);
  }
}
