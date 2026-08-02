import flexpriceClient from './client.js';
import { normalizeFlexpriceError } from './errors.js';

/**
 * Creates a new subscription in Flexprice.
 * @param {object} subscriptionData - { external_customer_id, plan_id, currency, billing_period }
 * @returns {Promise<object>} The created subscription response
 */
export async function createSubscription(subscriptionData) {
  try {
    const payload = {
      external_customer_id: subscriptionData.external_customer_id,
      plan_id: subscriptionData.plan_id,
      currency: subscriptionData.currency || 'usd',
      billing_period: subscriptionData.billing_period || 'MONTHLY',
      billing_cycle: 'anniversary'
    };

    const response = await flexpriceClient.post('/subscriptions', payload);
    return response;
  } catch (error) {
    throw normalizeFlexpriceError(error);
  }
}

/**
 * Changes a subscription plan (upgrade/downgrade).
 * @param {string} subscriptionId - The ID of the subscription to change
 * @param {string} newPlanId - The target plan ID
 * @returns {Promise<object>} Plan change execution response
 */
export async function changeSubscriptionPlan(subscriptionId, newPlanId) {
  try {
    const payload = {
      target_plan_id: newPlanId,
      proration_behavior: 'create_prorations',
      billing_period: 'MONTHLY',
      billing_cycle: 'anniversary',
      billing_cadence: 'RECURRING'
    };

    const response = await flexpriceClient.post(`/subscriptions/${subscriptionId}/change/execute`, payload);
    return response;
  } catch (error) {
    throw normalizeFlexpriceError(error);
  }
}

/**
 * Retrieves subscription details by subscription ID.
 * @param {string} subscriptionId - Subscription ID
 * @returns {Promise<object>} Subscription details
 */
export async function getSubscription(subscriptionId) {
  try {
    const response = await flexpriceClient.get(`/subscriptions/${subscriptionId}`);
    return response;
  } catch (error) {
    throw normalizeFlexpriceError(error);
  }
}

/**
 * Retrieves subscriptions for a customer by their external ID.
 * @param {string} externalCustomerId - Customer external ID
 * @returns {Promise<array>} Array of active subscriptions
 */
export async function getCustomerSubscriptions(externalCustomerId) {
  try {
    const response = await flexpriceClient.get(`/customers/external/${externalCustomerId}/subscriptions`);
    return response;
  } catch (error) {
    throw normalizeFlexpriceError(error);
  }
}
