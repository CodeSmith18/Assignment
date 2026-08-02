import express from 'express';
import { nanoid } from 'nanoid';
import { getDatabase, runQuery } from '../db/init.js';
import { checkUsageQuota, checkBooleanFeature, getCurrentUsage } from '../services/entitlementService.js';
import { summarize, rewrite } from '../services/aiService.js';
import { ingestEvent } from '../flexprice/events.js';

const router = express.Router();

// Performance metrics for routes
const routeMetrics = {
  totalRequests: 0,
  successfulOperations: 0,
  quotaBlocks: 0,
  featureBlocks: 0,
  averageProcessingTime: 0,
  aiServiceErrors: 0,
  flexpriceErrors: 0
};

function updateRouteMetrics(operationType, success, processingTime, errorType = null) {
  routeMetrics.totalRequests++;
  if (success) routeMetrics.successfulOperations++;
  
  if (errorType === 'quota_exceeded') routeMetrics.quotaBlocks++;
  if (errorType === 'feature_locked') routeMetrics.featureBlocks++;
  if (errorType === 'ai_service_error') routeMetrics.aiServiceErrors++;
  if (errorType === 'flexprice_error') routeMetrics.flexpriceErrors++;
  
  routeMetrics.averageProcessingTime = 
    routeMetrics.averageProcessingTime === 0
      ? processingTime
      : (routeMetrics.averageProcessingTime * 0.9) + (processingTime * 0.1);
}

/**
 * Inserts a text processing operation history record into SQLite.
 */
async function storeOperation(operationData) {
  const db = getDatabase();
  try {
    const sql = `
      INSERT INTO operations (user_id, operation_type, tone, input_chars, input_preview, output_preview, flexprice_event_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      operationData.userId,
      operationData.operationType,
      operationData.tone || null,
      operationData.inputChars,
      operationData.inputPreview.substring(0, 200), // Truncate for storage efficiency
      operationData.outputPreview.substring(0, 200),
      operationData.flexpriceEventId
    ];
    
    const result = await runQuery(db, sql, params);
    return result.id;
  } finally {
    db.close();
  }
}

/**
 * POST /api/process
 * Core metered endpoint for text summarization and rewriting
 */
router.post('/', async (req, res) => {
  const startTime = Date.now();
  const { text, operation, tone } = req.body;
  const user = req.user;

  // 1. Input Validation
  if (!text || typeof text !== 'string') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Text content to process is required.'
      }
    });
  }

  if (!operation || (operation !== 'summarize' && operation !== 'rewrite')) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: "Operation must be either 'summarize' or 'rewrite'."
      }
    });
  }

  const cleanTone = tone ? tone.toLowerCase().trim() : 'default';
  const allowedTones = ['default', 'professional', 'casual', 'academic', 'creative'];
  if (operation === 'rewrite' && !allowedTones.includes(cleanTone)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `Tone must be one of: ${allowedTones.join(', ')}.`
      }
    });
  }

  try {
    // 2. Entitlement checking
    console.debug(`[Text Route] Performing quota check for customer: ${user.external_customer_id}`);
    const quotaCheck = await checkUsageQuota(user.external_customer_id, text.length);
    
    if (!quotaCheck.allowed) {
      updateRouteMetrics(operation, false, 0, 'quota_exceeded');
      return res.status(402).json({
        success: false,
        blocked: true,
        reason: quotaCheck.reason,
        message: quotaCheck.message,
        usage: {
          charactersProcessed: quotaCheck.usage
        },
        upgradeRequired: quotaCheck.upgradeRequired,
        plan: quotaCheck.plan
      });
    }

    // Check premium feature gate if tone selection is active
    if (operation === 'rewrite' && cleanTone !== 'default') {
      console.debug(`[Text Route] Performing boolean feature check for customer: ${user.external_customer_id}`);
      const featureCheck = await checkBooleanFeature(user.external_customer_id, 'tone_selector');
      
      if (!featureCheck.hasAccess) {
        updateRouteMetrics(operation, false, 0, 'feature_locked');
        return res.status(402).json({
          success: false,
          blocked: true,
          reason: 'feature_locked',
          message: featureCheck.message,
          feature: 'tone_selector',
          requestedTone: cleanTone,
          upgradeRequired: featureCheck.upgradeRequired,
          plan: featureCheck.plan
        });
      }
    }

    // 3. AI Processing
    let aiResult = null;
    if (operation === 'summarize') {
      console.debug('[Text Route] Invoking BART summarization...');
      aiResult = await summarize(text, quotaCheck.plan);
    } else {
      console.debug(`[Text Route] Invoking T5 rewriting with tone: ${cleanTone}...`);
      aiResult = await rewrite(text, cleanTone, quotaCheck.plan);
    }

    if (!aiResult.success) {
      updateRouteMetrics(operation, false, 0, 'ai_service_error');
      return res.status(res.statusCode === 400 ? 400 : 503).json({
        success: false,
        error: {
          code: aiResult.error === 'text_too_long' ? 'VALIDATION_ERROR' : 'SERVICE_UNAVAILABLE',
          message: aiResult.message || 'AI service temporarily unavailable. Please try again.'
        }
      });
    }

    // 4. Flexprice Event Ingestion
    const eventId = `evt_${nanoid(16)}`;
    try {
      console.debug(`[Text Route] Ingesting usage event ${eventId} to Flexprice...`);
      await ingestEvent({
        event_id: eventId,
        event_name: 'text_processed',
        external_customer_id: user.external_customer_id,
        properties: {
          char_count: text.length,
          operation_type: operation,
          tone: operation === 'rewrite' ? cleanTone : 'default'
        }
      });
    } catch (ingestError) {
      // Non-blocking: log the error and proceed
      console.error(`[Text Route] Flexprice event ingestion failed for ${eventId}:`, ingestError.message);
      updateRouteMetrics(operation, true, 0, 'flexprice_error');
    }

    // 5. Operation History Storage
    const outputText = operation === 'summarize' ? aiResult.summary : aiResult.rewrittenText;
    try {
      await storeOperation({
        userId: user.id,
        operationType: operation,
        tone: operation === 'rewrite' ? cleanTone : null,
        inputChars: text.length,
        inputPreview: text,
        outputPreview: outputText,
        flexpriceEventId: eventId
      });
    } catch (dbError) {
      // Non-blocking: log and proceed
      console.error('[Text Route] SQLite operation history storage failed:', dbError.message);
    }

    // 6. Response Compilation (Get updated usage)
    // Wait briefly (500ms) for Kafka/Clickhouse pipeline latency to process usage event
    await new Promise(resolve => setTimeout(resolve, 500));
    
    let updatedUsage = null;
    let currentPlan = user.plan;
    
    try {
      const usageData = await getCurrentUsage(user.external_customer_id);
      updatedUsage = usageData.usage;
      currentPlan = usageData.plan.name;
    } catch (usageError) {
      console.error('[Text Route] Failed to fetch updated usage after event ingestion:', usageError.message);
      
      // Fallback: estimate usage
      const prevUsage = quotaCheck.usage || { current: 0, limit: 2000 };
      const estCurrent = prevUsage.current + text.length;
      updatedUsage = {
        charactersProcessed: {
          current: estCurrent,
          limit: prevUsage.limit,
          remaining: Math.max(0, prevUsage.limit - estCurrent),
          percent: parseFloat(((estCurrent / prevUsage.limit) * 100).toFixed(1))
        }
      };
    }

    const processingTime = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));
    updateRouteMetrics(operation, true, processingTime);

    return res.json({
      success: true,
      operation,
      result: aiResult,
      usage: updatedUsage,
      eventId,
      plan: currentPlan
    });

  } catch (error) {
    console.error('[Text Route Error] Process endpoint failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected server error occurred during text processing.'
      }
    });
  }
});

// Expose route performance metrics (mainly for admin/testing dashboard)
router.get('/metrics', (req, res) => {
  res.json({
    success: true,
    metrics: routeMetrics
  });
});

export default router;
