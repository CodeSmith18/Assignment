import express from 'express';
import { getDatabase, allQuery } from '../db/init.js';
import { getCurrentUsage } from '../services/entitlementService.js';

const router = express.Router();

/**
 * GET /api/usage
 * Retrieves live subscription usage metrics and local operation history logs
 */
router.get('/', async (req, res) => {
  const user = req.user;
  const db = getDatabase();

  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    // Fetch live usage from Flexprice
    console.debug(`[Usage Route] Fetching live Flexprice entitlements for user: ${user.external_customer_id}`);
    const flexpriceUsage = await getCurrentUsage(user.external_customer_id);

    // Fetch local operations history
    console.debug(`[Usage Route] Querying SQLite operation history for user ID: ${user.id}`);
    const sql = `
      SELECT id, operation_type, tone, input_chars, input_preview, output_preview, flexprice_event_id, created_at
      FROM operations
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const history = await allQuery(db, sql, [user.id, limit, offset]);

    return res.json({
      success: true,
      plan: flexpriceUsage.plan,
      usage: flexpriceUsage.usage,
      features: flexpriceUsage.features,
      subscription: flexpriceUsage.subscription,
      history
    });

  } catch (error) {
    console.error('[Usage Route Error] Failed to compile usage dashboard:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unable to retrieve usage details.'
      }
    });
  } finally {
    db.close();
  }
});

export default router;
