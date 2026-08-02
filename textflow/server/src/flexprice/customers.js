import flexpriceClient from './client.js';
import { normalizeFlexpriceError } from './errors.js';

/**
 * Creates a new customer in Flexprice.
 * @param {object} customerData - { external_id, name, email }
 * @returns {Promise<object>} The created customer object
 */
export async function createCustomer(customerData) {
  try {
    const response = await flexpriceClient.post('/customers', {
      external_id: customerData.external_id,
      name: customerData.name,
      email: customerData.email
    });
    return response;
  } catch (error) {
    throw normalizeFlexpriceError(error);
  }
}

/**
 * Retrieves a customer by their external_id.
 * @param {string} externalId - The app's local user ID mapped to Flexprice
 * @returns {Promise<object|null>} The customer object or null if not found
 */
export async function getCustomerByExternalId(externalId) {
  try {
    const response = await flexpriceClient.get(`/customers/external/${externalId}`);
    return response;
  } catch (error) {
    const normalized = normalizeFlexpriceError(error);
    if (normalized.status === 404) {
      return null;
    }
    throw normalized;
  }
}

/**
 * Retrieves customer entitlements by external_id.
 * @param {string} externalId - Customer external ID
 * @returns {Promise<object>} Entitlements response containing aggregated features
 */
export async function getCustomerEntitlements(externalId) {
  try {
    const response = await flexpriceClient.get(`/customers/external/${externalId}/entitlements`);
    return response;
  } catch (error) {
    throw normalizeFlexpriceError(error);
  }
}

/**
 * Retrieves usage summary for a customer.
 * @param {object} params - { customer_id, customer_lookup_key, feature_ids, feature_lookup_keys, subscription_ids }
 * @returns {Promise<object>} Usage summary containing features usage statistics
 */
export async function getCustomerUsage(params) {
  try {
    const queryParams = {};
    if (params.customer_id) queryParams.customer_id = params.customer_id;
    if (params.customer_lookup_key) queryParams.customer_lookup_key = params.customer_lookup_key;
    if (params.feature_ids) queryParams.feature_ids = params.feature_ids.join(',');
    if (params.feature_lookup_keys) queryParams.feature_lookup_keys = params.feature_lookup_keys.join(',');
    if (params.subscription_ids) queryParams.subscription_ids = params.subscription_ids.join(',');

    const response = await flexpriceClient.get('/customers/usage', { params: queryParams });
    return response;
  } catch (error) {
    throw normalizeFlexpriceError(error);
  }
}
