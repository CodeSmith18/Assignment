import { getUserById } from '../db/queries.js';

/**
 * Middleware that requires the user to be authenticated via session.
 * Rejects requests with 401 Unauthorized if not authenticated.
 */
export async function requireAuth(req, res, next) {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required. Please log in.'
        }
      });
    }

    const user = await getUserById(req.session.userId);
    if (!user) {
      // Session exists but user was deleted from database
      req.session.destroy();
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User session invalid. Please log in again.'
        }
      });
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('[Auth Middleware Error] Failed to verify authentication:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during authentication verification.'
      }
    });
  }
}

/**
 * Middleware that optionally loads the authenticated user.
 * Does not reject requests if not authenticated, just sets req.user to null.
 */
export async function optionalAuth(req, res, next) {
  try {
    if (req.session && req.session.userId) {
      const user = await getUserById(req.session.userId);
      if (user) {
        req.user = user;
        return next();
      }
    }
    
    req.user = null;
    next();
  } catch (error) {
    console.error('[Auth Middleware Error] Failed in optional authentication:', error);
    req.user = null;
    next();
  }
}
