import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { authenticate, signToken, createUserService } from '@/middleware/auth';
import { DatabaseService } from '@/services/DatabaseService';

const router = Router();

// Hold a reference to the UserService — initialized lazily
let userService: ReturnType<typeof createUserService> | null = null;

/**
 * Initialize the auth module with a reference to the database service.
 * Called once during server startup.
 */
export function initAuthRoutes(databaseService: DatabaseService): void {
  userService = createUserService(databaseService.isDatabaseAvailable());
  logger.info('Auth routes initialized with user service');
}

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return JWT token
 * @access  Public
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      res.status(400).json({
        success: false,
        message: 'Username and password are required.',
      });
      return;
    }

    if (typeof username !== 'string' || typeof password !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Username and password must be strings.',
      });
      return;
    }

    if (!userService) {
      res.status(500).json({
        success: false,
        message: 'Auth service not initialized.',
      });
      return;
    }

    logger.info('Login attempt:', { username: username.toLowerCase(), ip: req.ip });

    // Validate credentials
    const user = await userService.validatePassword(username, password);

    if (!user) {
      logger.warn('Failed login attempt:', { username: username.toLowerCase(), ip: req.ip });
      res.status(401).json({
        success: false,
        message: 'Invalid username or password.',
      });
      return;
    }

    if (!user.isActive) {
      logger.warn('Inactive user login attempt:', { username: username.toLowerCase(), ip: req.ip });
      res.status(403).json({
        success: false,
        message: 'Account is disabled. Contact an administrator.',
      });
      return;
    }

    // Generate JWT
    const token = signToken(user);

    logger.info('Successful login:', { username: user.username, role: user.role, ip: req.ip });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        displayName: user.displayName,
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Invalidate current session (client-side token discard)
 * @access  Private
 */
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    logger.info('Logout:', { username: req.authenticatedUser?.username, ip: req.ip });

    // In a production system, we would blacklist the token here.
    // For now, we rely on the client discarding the token.
    res.json({
      success: true,
      message: 'Logout successful. Token discarded.',
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * @route   GET /api/auth/verify
 * @desc    Verify JWT token validity and return current user info
 * @access  Private
 */
router.get('/verify', authenticate, async (req: Request, res: Response) => {
  try {
    const authUser = req.authenticatedUser!;

    // Optionally refresh user details from the database
    if (userService) {
      const freshUser = await userService.findById(authUser.id);
      if (!freshUser) {
        res.status(401).json({
          success: false,
          message: 'User no longer exists.',
        });
        return;
      }

      if (!freshUser.isActive) {
        res.status(403).json({
          success: false,
          message: 'Account is disabled.',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Token is valid',
        user: {
          id: freshUser.id,
          username: freshUser.username,
          email: freshUser.email,
          role: freshUser.role,
          displayName: freshUser.displayName,
        },
      });
      return;
    }

    // Fallback: return data from token
    res.json({
      success: true,
      message: 'Token is valid',
      user: {
        id: authUser.id,
        username: authUser.username,
        email: authUser.email,
        role: authUser.role,
        displayName: authUser.displayName,
      },
    });
  } catch (error) {
    logger.error('Token verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user profile
 * @access  Private
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const authUser = req.authenticatedUser!;

    if (userService) {
      const user = await userService.findById(authUser.id);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found.',
        });
        return;
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          displayName: user.displayName,
          isActive: user.isActive,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: authUser,
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

export const authRoutes = router;
