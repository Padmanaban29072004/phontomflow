import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '@/utils/logger';
import { UserService, SafeUser } from '@/models/User';

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      authenticatedUser?: SafeUser;
    }
  }
}

/**
 * JWT payload structure
 */
export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Get JWT secret from environment
 */
function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'phantom-flow-default-secret-change-in-production';
}

/**
 * Get JWT expiration from environment
 */
function getJwtExpiration(): string {
  return process.env.JWT_EXPIRES_IN || '24h';
}

/**
 * Sign a JWT token for a user
 */
export function signToken(user: SafeUser): string {
  const payload: JwtPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: getJwtExpiration() as any,
  });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getJwtSecret()) as JwtPayload;
}

/**
 * Authentication middleware — extracts and verifies JWT from Authorization header.
 * On success, attaches `authenticatedUser` to the request object.
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      success: false,
      message: 'Authentication required. No authorization header provided.',
    });
    return;
  }

  // Expect "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({
      success: false,
      message: 'Invalid authorization header format. Expected: Bearer <token>',
    });
    return;
  }

  const token = parts[1];

  try {
    const decoded = verifyToken(token);

    // Attach minimal user info to request
    req.authenticatedUser = {
      id: decoded.userId,
      username: decoded.username,
      role: decoded.role as SafeUser['role'],
      email: '',
      displayName: decoded.username,
      isActive: true,
      createdAt: new Date(),
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: 'Token has expired. Please login again.',
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: 'Invalid token.',
      });
      return;
    }

    logger.error('JWT verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.',
    });
  }
}

/**
 * Optional authentication — if a valid token is present, attach user info;
 * if not, continue without error (for routes that optionally use user context).
 */
export function optionalAuthenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    next();
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    next();
    return;
  }

  try {
    const decoded = verifyToken(parts[1]);
    req.authenticatedUser = {
      id: decoded.userId,
      username: decoded.username,
      role: decoded.role as SafeUser['role'],
      email: '',
      displayName: decoded.username,
      isActive: true,
      createdAt: new Date(),
    };
  } catch {
    // Silently continue — token is invalid but auth is optional
  }

  next();
}

/**
 * Role-based authorization middleware.
 * Must be used AFTER `authenticate` middleware.
 */
export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.authenticatedUser) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
      return;
    }

    if (!allowedRoles.includes(req.authenticatedUser.role)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
}

/**
 * Create a UserService instance based on whether MongoDB is available.
 * This should be called once at startup and passed around.
 */
export function createUserService(mongoAvailable: boolean): UserService {
  return new UserService(mongoAvailable);
}
