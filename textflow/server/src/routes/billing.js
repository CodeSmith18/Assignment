import express from 'express';
import { config } from '../config/env.js';
import { getDatabase, runQuery } from '../db/init.js';
import { getCustomerSubscriptions, changeSubscriptionPlan } from '../flexprice/subscriptions.js';

const router = express.Router();

/**
 * Helper to update local SQLite user plan and update session cache.
 */
async function updateLocalUserPlan(userId, planName, req) {
  const db = getDatabase();
  try {
    const sql = `UPDATE users SET plan = ? WHERE id = ?`;
    await runQuery(db, sql, [planName, userId]);
    
    // Update session store if present
    if (req.session && req.session.user) {
      req.session.user.plan = planName;
    }
    if (req.user) {
      req.user.plan = planName;
    }
  } finally {
    db.close();
  }
}

/**
 * POST /api/billing/upgrade
 * Upgrades customer active subscription to the Pro Plan
 */
router.post('/upgrade', async (req, res) => {
  const user = req.user;

  try {
    console.debug(`[Billing Route] Fetching subscriptions for customer: ${user.external_customer_id}`);
    const subscriptionsRes = await getCustomerSubscriptions(user.external_customer_id);
    
    const activeSub = (subscriptionsRes.items || []).find(
      s => s.subscription_status === 'active'
    );

    if (!activeSub) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'No active subscription found to upgrade.'
        }
      });
    }

    console.debug(`[Billing Route] Transitioning subscription ${activeSub.id} to Pro Plan: ${config.proPlanId}`);
    const transitionRes = await changeSubscriptionPlan(activeSub.id, config.proPlanId);

    // Update local DB & session cache
    await updateLocalUserPlan(user.id, 'pro', req);
    console.log(`[Billing Route] Upgraded local user ID ${user.id} to Pro.`);

    return res.json({
      success: true,
      message: 'Subscription upgraded to Pro successfully.',
      subscription: {
        id: transitionRes.id || activeSub.id,
        planId: config.proPlanId,
        status: 'active'
      }
    });

  } catch (error) {
    console.error('[Billing Route Error] Upgrade failed:', error);
    res.status(error.status || 500).json({
      success: false,
      error: {
        code: error.code || 'BILLING_ERROR',
        message: error.message || 'Billing upgrade failed. Please contact support.'
      }
    });
  }
});

/**
 * POST /api/billing/downgrade
 * Downgrades customer active subscription to the Free Plan
 */
router.post('/downgrade', async (req, res) => {
  const user = req.user;

  try {
    console.debug(`[Billing Route] Fetching subscriptions for customer: ${user.external_customer_id}`);
    const subscriptionsRes = await getCustomerSubscriptions(user.external_customer_id);
    
    const activeSub = (subscriptionsRes.items || []).find(
      s => s.subscription_status === 'active'
    );

    if (!activeSub) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'No active subscription found to downgrade.'
        }
      });
    }

    console.debug(`[Billing Route] Transitioning subscription ${activeSub.id} to Free Plan: ${config.freePlanId}`);
    const transitionRes = await changeSubscriptionPlan(activeSub.id, config.freePlanId);

    // Update local DB & session cache
    await updateLocalUserPlan(user.id, 'free', req);
    console.log(`[Billing Route] Downgraded local user ID ${user.id} to Free.`);

    return res.json({
      success: true,
      message: 'Subscription downgraded to Free successfully.',
      subscription: {
        id: transitionRes.id || activeSub.id,
        planId: config.freePlanId,
        status: 'active'
      }
    });

  } catch (error) {
    console.error('[Billing Route Error] Downgrade failed:', error);
    res.status(error.status || 500).json({
      success: false,
      error: {
        code: error.code || 'BILLING_ERROR',
        message: error.message || 'Billing downgrade failed. Please contact support.'
      }
    });
  }
});

export default router;
