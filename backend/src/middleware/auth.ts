import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'danapro_local_jwt_secret_token_change_in_production';

export interface AuthenticatedRequest extends Request {
  user?: {
    email: string;
    role: 'superadmin' | 'admin' | 'ngo_admin' | 'ngo_manager' | 'ngo_viewer';
    organizationId?: string;
    orgSlug?: string;
    userId?: string;
    permissions?: Record<string, Record<string, boolean>>;
  };
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token = req.cookies?.token;

  // Fallback to headers (for API testing/third-party widgets)
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required: Session token missing.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Session expired or invalid token.' });
  }
}

export function authorizeRole(roles: Array<'superadmin' | 'admin' | 'ngo_admin' | 'ngo_manager' | 'ngo_viewer'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access forbidden: Insufficient roles.' });
    }
    next();
  };
}

/**
 * Optional auth — sets req.user if token is present, but does not reject unauthenticated requests.
 * Used for public endpoints that behave differently for authenticated users.
 */
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token = req.cookies?.token;
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = decoded;
    } catch {
      // Token invalid — continue as unauthenticated
    }
  }
  next();
}
