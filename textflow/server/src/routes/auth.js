import express from 'express';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { createUser, getUserByEmail } from '../db/queries.js';
import { createCustomer } from '../flexprice/customers.js';
import { createSubscription } from '../flexprice/subscriptions.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { config } from '../config/env.js';
import flexpriceClient from '../flexprice/client.js';

const router = express.Router();

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/signup
 * Register a new user and automatically integrate with Flexprice (Customer + Free Subscription)
 */
router.post('/signup', async (req, res) => {
  const { email, password, name } = req.body;

  // 1. Basic validation
  if (!email || !password || !name) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Email, password, and name are required.'
      }
    });
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanName = name.trim();

  if (!EMAIL_REGEX.test(cleanEmail)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please provide a valid email address.'
      }
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Password must be at least 8 characters long.'
      }
    });
  }

  try {
    // 2. Check for duplicate email
    const existingUser = await getUserByEmail(cleanEmail);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_EMAIL',
          message: 'An account with this email address already exists.'
        }
      });
    }

    // Ensure we have the FREE_PLAN_ID configured
    if (!config.freePlanId) {
      console.error('❌ Sign Up Error: FREE_PLAN_ID is not configured in environment variables.');
      return res.status(503).json({
        success: false,
        error: {
          code: 'CONFIG_ERROR',
          message: 'Server billing configuration error. Please try again later.'
        }
      });
    }

    // 3. Setup integration variables
    const externalCustomerId = `user_${nanoid(12)}`;
    let flexpriceCustomer = null;
    let flexpriceSubscription = null;

    // 4. Flexprice Integration Flow
    try {
      console.log(`[Signup Flow] Step A: Creating customer inside Flexprice: ${externalCustomerId}`);
      flexpriceCustomer = await createCustomer({
        external_id: externalCustomerId,
        name: cleanName,
        email: cleanEmail
      });
      console.log(`[Signup Flow] Step A Success: Customer ID: ${flexpriceCustomer.id}`);

      console.log(`[Signup Flow] Step B: Creating Free plan subscription for: ${externalCustomerId}`);
      flexpriceSubscription = await createSubscription({
        external_customer_id: externalCustomerId,
        plan_id: config.freePlanId,
        currency: 'usd',
        billing_period: 'MONTHLY'
      });
      console.log(`[Signup Flow] Step B Success: Subscription ID: ${flexpriceSubscription.id}`);

    } catch (flexpriceError) {
      console.error('[Signup Flow] Flexprice provisioning failed:', flexpriceError);
      
      // Rollback Flexprice customer if subscription failed but customer was created
      if (flexpriceCustomer && flexpriceCustomer.id) {
        console.log(`[Signup Flow Rollback] Deleting orphan Flexprice customer: ${flexpriceCustomer.id}`);
        await flexpriceClient.delete(`/customers/${flexpriceCustomer.id}`).catch(err => {
          console.error('[Signup Flow Rollback] Failed to clean up customer:', err.message);
        });
      }

      return res.status(503).json({
        success: false,
        error: {
          code: 'BILLING_SERVICE_UNAVAILABLE',
          message: 'Billing provider integration failed. Please try again later.',
          details: flexpriceError.message
        }
      });
    }

    // 5. Local Database User Creation
    let newUser = null;
    try {
      const passwordHash = await bcrypt.hash(password, 12);
      
      newUser = await createUser({
        email: cleanEmail,
        password_hash: passwordHash,
        external_customer_id: externalCustomerId,
        flexprice_customer_id: flexpriceCustomer.id,
        flexprice_subscription_id: flexpriceSubscription.id,
        plan: 'free'
      });
      console.log(`[Signup Flow] Step C Success: Local user record created: ${newUser.id}`);

    } catch (dbError) {
      console.error('[Signup Flow] Database insertion failed:', dbError);

      // Rollback Flexprice entities on DB error
      if (flexpriceSubscription && flexpriceSubscription.id) {
        console.log(`[Signup Flow Rollback] Deleting Flexprice subscription: ${flexpriceSubscription.id}`);
        await flexpriceClient.delete(`/subscriptions/${flexpriceSubscription.id}`).catch(err => {
          console.error('[Signup Flow Rollback] Failed to clean up subscription:', err.message);
        });
      }
      if (flexpriceCustomer && flexpriceCustomer.id) {
        console.log(`[Signup Flow Rollback] Deleting Flexprice customer: ${flexpriceCustomer.id}`);
        await flexpriceClient.delete(`/customers/${flexpriceCustomer.id}`).catch(err => {
          console.error('[Signup Flow Rollback] Failed to clean up customer:', err.message);
        });
      }

      return res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to create user account. Please try again.'
        }
      });
    }

    // 6. Establish Session
    req.session.userId = newUser.id;

    return res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        external_customer_id: newUser.external_customer_id,
        plan: newUser.plan,
        created_at: newUser.created_at
      }
    });

  } catch (error) {
    console.error('[Signup Route Error] General signup failure:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected server error occurred.'
      }
    });
  }
});

/**
 * POST /api/auth/login
 * Log in an existing user
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Email and password are required.'
      }
    });
  }

  try {
    const user = await getUserByEmail(email);
    if (!user) {
      // Use generic error for security (prevent email enumeration)
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.'
        }
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.'
        }
      });
    }

    // Save to session
    req.session.userId = user.id;

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        external_customer_id: user.external_customer_id,
        plan: user.plan,
        created_at: user.created_at
      }
    });

  } catch (error) {
    console.error('[Login Route Error] Login failure:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected server error occurred.'
      }
    });
  }
});

/**
 * POST /api/auth/logout
 * Log out current user and destroy session
 */
router.post('/logout', (req, res) => {
  if (!req.session) {
    return res.json({ success: true, message: 'Already logged out.' });
  }

  req.session.destroy((err) => {
    if (err) {
      console.error('[Logout Route Error] Failed to destroy session:', err);
      return res.status(500).json({
        success: false,
        error: {
          code: 'SESSION_ERROR',
          message: 'Failed to complete logout.'
        }
      });
    }

    res.clearCookie('connect.sid'); // Clear default express-session cookie
    return res.json({
      success: true,
      message: 'Logged out successfully.'
    });
  });
});

/**
 * GET /api/auth/me
 * Retrieve details for currently authenticated user
 */
router.get('/me', requireAuth, (req, res) => {
  return res.json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      external_customer_id: req.user.external_customer_id,
      plan: req.user.plan,
      created_at: req.user.created_at
    }
  });
});

export default router;
