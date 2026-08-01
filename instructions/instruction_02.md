# Step 2: Flexprice Client Wrapper Implementation
## Implementation Instructions for TextFlow SaaS

### Overview
This step creates the backend API wrapper modules to communicate with your running Flexprice instance. You'll build a centralized HTTP client and specific service modules for customers, events, and subscriptions that your Express routes will use.

---

## Part A: Core HTTP Client Setup

### 1. Base Flexprice Client Module
**File:** `textflow/server/src/flexprice/client.js`

**Implement:**
- Create axios instance with base configuration
- Set base URL from environment variable (`FLEXPRICE_BASE_URL`)
- Configure default headers including the API key (`x-api-key`)
- Add request/response interceptors for logging and error handling
- Export a configured axios instance for other modules to use

**Key Requirements:**
- All requests should automatically include the API key header
- Response errors should be normalized to a consistent format
- Request logging for debugging (optional but helpful)
- Timeout configuration (30 seconds recommended)

### 2. Error Handling Utility
**File:** `textflow/server/src/flexprice/errors.js`

**Implement:**
- Create error classes for different Flexprice API failures
- Map HTTP status codes to meaningful error messages
- Handle network failures vs API validation errors differently
- Export error utilities that other modules can use

---

## Part B: Customer Management Module

### 3. Customer Operations
**File:** `textflow/server/src/flexprice/customers.js`

**Implement these functions:**

#### `createCustomer(customerData)`
- Make POST request to `/customers` endpoint
- Accept parameters: `external_id`, `name`, `email`
- Return the created customer object with Flexprice's internal ID
- Handle duplicate customer errors gracefully

#### `getCustomerByExternalId(externalId)`
- Make GET request to `/customers/external/{external_id}` endpoint
- Return customer data or null if not found
- Handle 404 errors as normal flow (customer doesn't exist)

#### `getCustomerEntitlements(externalId)`
- Make GET request to `/customers/external/{external_id}/entitlements`
- Return array of aggregated features with current entitlements
- Parse the response to extract usage limits and boolean feature states
- This will be heavily used by your auth middleware

#### `getCustomerUsage(customerId, featureIds)`
- Make GET request to `/customers/usage` with query parameters
- Accept customer ID and optional array of feature IDs to filter
- Return usage summary with current consumption and percentages
- Handle cases where usage data isn't available yet

**Testing Strategy:**
- Create a test script to verify connection to your running Flexprice instance
- Test customer creation with a dummy external_id
- Verify you can retrieve the created customer
- Test entitlement and usage endpoints with the test customer

---

## Part C: Event Ingestion Module

### 4. Usage Event Operations
**File:** `textflow/server/src/flexprice/events.js`

**Implement these functions:**

#### `ingestEvent(eventData)`
- Make POST request to `/events` endpoint
- Accept parameters: `event_name`, `external_customer_id`, `properties`, optional `timestamp`
- Handle the specific event structure for text processing: `{ char_count, operation_type, tone }`
- Return event confirmation or generated event ID
- Implement retry logic for temporary failures

#### `bulkIngestEvents(eventsArray)`
- Make POST request to `/events/bulk` endpoint
- Accept array of event objects for batch processing
- Useful for the pricing simulation script in later steps
- Handle partial failures in bulk operations

**Key Implementation Notes:**
- Events should be fire-and-forget from the user's perspective
- If event ingestion fails, log the error but don't block the user's text processing
- Include proper timestamp handling (default to current time if not provided)
- Validate required properties before sending to Flexprice

---

## Part D: Subscription Management Module

### 5. Subscription Operations
**File:** `textflow/server/src/flexprice/subscriptions.js`

**Implement these functions:**

#### `createSubscription(subscriptionData)`
- Make POST request to `/subscriptions` endpoint
- Accept parameters: `external_customer_id`, `plan_id`, `currency`, `billing_period`
- Handle the signup flow where new users get subscribed to Free plan automatically
- Return subscription object with Flexprice's internal subscription ID

#### `changeSubscriptionPlan(subscriptionId, newPlanId)`
- Make POST request to `/subscriptions/{id}/change/execute` endpoint
- Handle plan upgrades (Free to Pro) and downgrades
- This is the core of your upgrade mechanism
- Return updated subscription details

#### `getSubscription(subscriptionId)`
- Make GET request to `/subscriptions/{id}` endpoint
- Return current subscription details including plan and status
- Used for verification after plan changes

#### `getCustomerSubscriptions(externalCustomerId)`
- Make GET request to `/customers/external/{external_id}/subscriptions`
- Return array of active subscriptions for a customer
- Handle customers with multiple or no subscriptions

**Testing Strategy:**
- Create test subscription for a dummy customer
- Test plan changes between your Free and Pro plan IDs
- Verify subscription status updates correctly

---

## Part E: Integration Testing

### 6. End-to-End Test Script
**File:** `textflow/server/scripts/test-flexprice-connection.js`

**Implement a comprehensive test that:**
- Tests basic connectivity to Flexprice API
- Creates a test customer
- Creates a test subscription on Free plan
- Ingests a sample text processing event
- Retrieves customer usage and entitlements
- Upgrades to Pro plan
- Verifies entitlements changed correctly
- Cleans up test data (optional)

**Run this script to verify your implementation before proceeding to Step 3.**

---

## Part F: Environment Configuration Updates

### 7. Update Environment Variables
**File:** `textflow/server/.env`

**Add these variables that will be populated by the seed script:**
```
# Flexprice Entity IDs (will be filled by seed script)
CHAR_FEATURE_ID=
TONE_FEATURE_ID=
FREE_PLAN_ID=
PRO_PLAN_ID=
CHAR_METER_ID=
```

### 8. Environment Validation
**File:** `textflow/server/src/config/env.js`

**Implement validation that:**
- Checks all required environment variables are present
- Validates Flexprice connection on server startup
- Exports configuration object for other modules to use
- Fails fast if critical configuration is missing

---

## Implementation Guidelines

### Error Handling Patterns
- **Network failures:** Retry with exponential backoff
- **4xx errors:** Don't retry, return meaningful error to caller
- **5xx errors:** Retry up to 3 times, then fail
- **Rate limiting:** Respect any rate limit headers from Flexprice

### Response Data Handling
- Always validate response structure before using data
- Extract only the fields you need from Flexprice responses
- Convert Flexprice data formats to your app's internal formats
- Handle cases where expected fields might be missing

### Testing Approach
- Test with your actual running Flexprice instance, not mocks
- Verify the exact API response shapes match your expectations
- Test error conditions (invalid customer IDs, missing plans, etc.)
- Validate that the Flexprice aggregation works correctly for your meter

### Module Dependencies
- Each module (`customers.js`, `events.js`, `subscriptions.js`) should import the base client
- Modules should not depend on each other directly
- Keep functions focused and single-purpose
- Export individual functions, not classes

---

## Verification Checklist

**Before proceeding to Step 3, ensure:**
- [ ] All four Flexprice modules are implemented and tested
- [ ] Test script runs successfully against your Flexprice instance
- [ ] Customer creation and retrieval works
- [ ] Event ingestion accepts text processing events
- [ ] Subscription creation and plan changes work
- [ ] Error handling gracefully manages API failures
- [ ] Environment configuration validates required variables
- [ ] Response data is properly parsed and normalized

---

## Common Pitfalls to Avoid

1. **Hard-coding URLs:** Always use environment variables for endpoints
2. **Missing error handling:** Flexprice APIs can fail, plan for it
3. **Wrong response parsing:** Verify actual response structure in your running instance
4. **Ignoring async/await:** All HTTP calls should be properly awaited
5. **Not testing with real data:** Mock tests don't catch API integration issues

---

## Next Step Preview

**Step 3** will create the seed script that uses these modules to populate your Flexprice instance with the Features, Plans, Entitlements, and Prices needed for the TextFlow application. It will also generate the entity IDs and save them to your environment file.

The modules you build in this step are the foundation that both your Express routes and the seed script will use to interact with Flexprice.