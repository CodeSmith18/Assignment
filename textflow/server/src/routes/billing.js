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
  const { plan = 'pro' } = req.body;

  try {
    const targetPlanId = plan === 'payg' ? config.paygPlanId : config.proPlanId;
    const targetPlanName = plan === 'payg' ? 'payg' : 'pro';

    if (!targetPlanId) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'CONFIG_ERROR',
          message: `The plan '${plan}' is not configured on this server.`
        }
      });
    }

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

    console.debug(`[Billing Route] Transitioning subscription ${activeSub.id} to ${targetPlanName} Plan: ${targetPlanId}`);
    const transitionRes = await changeSubscriptionPlan(activeSub.id, targetPlanId);

    // Update local DB & session cache
    await updateLocalUserPlan(user.id, targetPlanName, req);
    console.log(`[Billing Route] Upgraded local user ID ${user.id} to ${targetPlanName}.`);

    return res.json({
      success: true,
      message: `Subscription upgraded to ${targetPlanName} successfully.`,
      subscription: {
        id: transitionRes.id || activeSub.id,
        planId: targetPlanId,
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

/**
 * POST /api/billing/settle
 * Simulates paying/settling the current balance and resetting the billing period start to now.
 */
router.post('/settle', async (req, res) => {
  const user = req.user;
  try {
    const { exec } = await import('child_process');
    const util = await import('util');
    const execPromise = util.promisify(exec);

    console.debug(`[Billing Route] Resetting billing period in Postgres for customer: ${user.external_customer_id}`);
    
    // Execute SQL update in postgres container to advance period start to NOW
    await execPromise('docker exec -t flexprice-postgres-1 psql -U flexprice -d flexprice -c "UPDATE subscriptions SET current_period_start = NOW(), current_period_end = NOW() + INTERVAL \'1 month\' WHERE subscription_status = \'active\';"');

    console.log(`[Billing Route] Successfully settled payment and reset billing cycle for customer: ${user.external_customer_id}`);
    
    return res.json({
      success: true,
      message: 'Payment settled and usage balance reset to zero.'
    });
  } catch (error) {
    console.error('[Billing Route Error] Settle failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SETTLE_ERROR',
        message: 'Failed to settle current balance. Check Docker container logs.'
      }
    });
  }
});

export default router;
