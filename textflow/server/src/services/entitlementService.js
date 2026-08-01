import { getCustomerEntitlements, getCustomerUsage } from '../flexprice/customers.js';
import { config } from '../config/env.js';

// Feature name mapping to environment variables
const FEATURE_MAPPING = {
  'tone_selector': config.toneFeatureId,
  'characters_processed': config.charFeatureId
};

/**
 * Helper to determine user's plan name dynamically based on their active subscription.
 * @param {array} subscriptions - Array of subscription objects from Flexprice
 * @returns {string} 'free' | 'pro' | 'unknown'
 */
function determinePlan(subscriptions) {
  if (!subscriptions || subscriptions.length === 0) {
    return 'free';
  }
  const activeSub = subscriptions.find(s => s.subscription_status === 'active') || subscriptions[0];
  if (activeSub.plan_id === config.proPlanId) {
    return 'pro';
  }
  return 'free';
}

/**
 * Checks if a user is within their monthly character processing quota.
 * @param {string} externalCustomerId - Customer's external ID
 * @param {number} incomingCharacterCount - Number of characters to process
 * @returns {Promise<object>} Validation decision payload
 */
export async function checkUsageQuota(externalCustomerId, incomingCharacterCount) {
  try {
    if (!config.charFeatureId) {
      return {
        allowed: false,
        reason: 'configuration_error',
        message: 'Characters Processed feature ID is not configured on the server.',
        plan: 'free'
      };
    }

    // 1. Fetch entitlements and usage in parallel
    const [entitlementsRes, usageRes] = await Promise.all([
      getCustomerEntitlements(externalCustomerId),
      getCustomerUsage({ customer_lookup_key: externalCustomerId, feature_ids: [config.charFeatureId] })
    ]);

    const plan = determinePlan(entitlementsRes.subscriptions);

    // 2. Extract entitlement limit
    const charEnt = entitlementsRes.features?.find(
      f => f.feature?.id === config.charFeatureId || f.feature?.name === 'Characters Processed'
    );

    if (!charEnt) {
      return {
        allowed: false,
        reason: 'configuration_error',
        message: 'Characters Processed entitlement not found in customer profile. Check seeding status.',
        plan
      };
    }

    const limit = charEnt.entitlement?.usage_limit || 2000;

    // 3. Extract current usage
    const charUsage = usageRes.features?.find(
      f => f.feature?.id === config.charFeatureId || f.feature?.name === 'Characters Processed'
    );

    const current = charUsage ? parseFloat(charUsage.current_usage || 0) : 0;
    const remaining = Math.max(0, limit - current);
    const afterProcessing = current + incomingCharacterCount;
    const percent = parseFloat(((current / limit) * 100).toFixed(1));

    const usagePayload = {
      current,
      limit,
      remaining,
      percent,
      afterProcessing
    };

    // 4. Decision check
    if (afterProcessing > limit) {
      const upgradeMsg = plan === 'free' 
        ? 'Upgrade to Pro for 50,000 characters/month.'
        : 'Contact support to increase your Pro plan usage limits.';
      
      return {
        allowed: false,
        reason: 'quota_exceeded',
        message: `You've reached your monthly character limit of ${limit.toLocaleString()}. ${upgradeMsg}`,
        usage: usagePayload,
        plan,
        upgradeRequired: plan === 'free'
      };
    }

    return {
      allowed: true,
      usage: usagePayload,
      plan
    };

  } catch (error) {
    console.error(`[Entitlement Service] checkUsageQuota failed for ${externalCustomerId}:`, error);
    
    // Fail-open strategy: Allow request, log error
    return {
      allowed: true,
      failOpen: true,
      reason: 'entitlement_check_failed',
      message: 'Unable to verify account limits. Failing open.',
      usage: {
        current: 0,
        limit: 2000,
        remaining: 2000,
        percent: 0,
        afterProcessing: incomingCharacterCount
      },
      plan: 'free'
    };
  }
}

/**
 * Checks if a user has access to a specific boolean feature.
 * @param {string} externalCustomerId - Customer's external ID
 * @param {string} featureName - Mapping key of the feature ('tone_selector')
 * @returns {Promise<object>} Access decision payload
 */
export async function checkBooleanFeature(externalCustomerId, featureName) {
  const mappedId = FEATURE_MAPPING[featureName];
  
  if (!mappedId) {
    return {
      hasAccess: false,
      feature: featureName,
      reason: 'configuration_error',
      message: `Feature "${featureName}" mapping not configured on the server.`
    };
  }

  try {
    const entitlementsRes = await getCustomerEntitlements(externalCustomerId);
    const plan = determinePlan(entitlementsRes.subscriptions);

    const featureEnt = entitlementsRes.features?.find(
      f => f.feature?.id === mappedId
    );

    if (!featureEnt || !featureEnt.entitlement?.is_enabled) {
      return {
        hasAccess: false,
        feature: featureName,
        plan,
        enabled: false,
        message: 'Tone selection is available on Pro plans. Upgrade to access advanced rewriting options.',
        upgradeRequired: plan === 'free'
      };
    }

    return {
      hasAccess: true,
      feature: featureName,
      plan,
      enabled: true
    };

  } catch (error) {
    console.error(`[Entitlement Service] checkBooleanFeature failed for ${externalCustomerId} (${featureName}):`, error);
    
    // Fail-open strategy: Allow request, log error
    return {
      hasAccess: true,
      failOpen: true,
      feature: featureName,
      plan: 'free',
      enabled: true,
      reason: 'entitlement_check_failed',
      message: 'Unable to verify feature access. Failing open.'
    };
  }
}

/**
 * Compiles a comprehensive usage dashboard payload.
 * @param {string} externalCustomerId - Customer's external ID
 * @returns {Promise<object>} Dashboard details
 */
export async function getCurrentUsage(externalCustomerId) {
  try {
    // Fetch entitlements and usage in parallel
    const [entitlementsRes, usageRes] = await Promise.all([
      getCustomerEntitlements(externalCustomerId),
      getCustomerUsage({ customer_lookup_key: externalCustomerId })
    ]);

    const planName = determinePlan(entitlementsRes.subscriptions);
    const activeSub = entitlementsRes.subscriptions?.find(s => s.subscription_status === 'active') || {};

    // 1. Compile metered usage
    const charEnt = entitlementsRes.features?.find(f => f.feature?.id === config.charFeatureId);
    const charUsage = usageRes.features?.find(f => f.feature?.id === config.charFeatureId);
    
    const charLimit = charEnt?.entitlement?.usage_limit || 2000;
    const charCurrent = charUsage ? parseFloat(charUsage.current_usage || 0) : 0;
    const charRemaining = Math.max(0, charLimit - charCurrent);
    const charPercent = parseFloat(((charCurrent / charLimit) * 100).toFixed(1));

    // 2. Compile boolean features
    const toneEnt = entitlementsRes.features?.find(f => f.feature?.id === config.toneFeatureId);
    const toneEnabled = !!toneEnt?.entitlement?.is_enabled;

    return {
      success: true,
      usage: {
        charactersProcessed: {
          current: charCurrent,
          limit: charLimit,
          remaining: charRemaining,
          percent: charPercent,
          resetDate: activeSub.current_period_end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      },
      features: {
        toneSelector: {
          enabled: toneEnabled,
          available: toneEnabled
        }
      },
      plan: {
        name: planName,
        displayName: planName.charAt(0).toUpperCase() + planName.slice(1),
        limits: {
          charactersPerMonth: charLimit
        }
      },
      subscription: {
        id: activeSub.id || null,
        status: activeSub.subscription_status || 'none',
        currentPeriodStart: activeSub.current_period_start || null,
        currentPeriodEnd: activeSub.current_period_end || null
      }
    };

  } catch (error) {
    console.error(`[Entitlement Service] getCurrentUsage failed for ${externalCustomerId}:`, error);
    throw error;
  }
}
