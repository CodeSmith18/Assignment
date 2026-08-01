# Output 08: Usage & Billing Routes

This document lists the exact files implemented and modified for **Step 8: Usage & Billing Routes**.

---

## 📁 Implemented and Modified Files

### 1. Usage Router
* **File Path**: [textflow/server/src/routes/usage.js](file:///d:/Assingment/textflow/server/src/routes/usage.js)
* **Description**: Returns data for the dashboard.
* **Details**:
  * Exposes `GET /api/usage` protected by `requireAuth` middleware.
  * Queries real-time entitlement details, reset dates, and active plans from Flexprice.
  * Queries the local SQLite database for operation history logs (truncated previews of inputs and outputs).

### 2. Billing Router
* **File Path**: [textflow/server/src/routes/billing.js](file:///d:/Assingment/textflow/server/src/routes/billing.js)
* **Description**: Subscription upgrade and downgrade routes.
* **Details**:
  * Exposes `POST /api/billing/upgrade` and `POST /api/billing/downgrade` protected by `requireAuth`.
  * Fetches the customer's active subscription ID dynamically from Flexprice.
  * Transitions plans between Free (`FREE_PLAN_ID`) and Pro (`PRO_PLAN_ID`) using the Flexprice API.
  * Updates the local database and session cache dynamically.

### 3. Server Configuration
* **File Path**: [textflow/server/src/server.js](file:///d:/Assingment/textflow/server/src/server.js)
* **Description**: Express application router imports and route mounting.
* **Details**:
  * Mounted `usageRoutes` and `billingRoutes` under protection checks.

### 4. Billing Verification Test Script
* **File Path**: [textflow/server/scripts/test-billing-routes.js](file:///d:/Assingment/textflow/server/scripts/test-billing-routes.js)
* **Description**: Integration test suite verifying billing status changes and dashboard data sync.
* **Details**:
  * Boots a mock Express server on port 4006.
  * Asserts:
    1. Initial dashboard stats correctly report the Free plan and its limits.
    2. Successful upgrade to Pro plan (200 success).
    3. Updated dashboard stats correctly report the Pro plan and active tone selectors.
    4. Successful downgrade back to Free plan (200 success).
    5. Dashboard stats correctly revert back to Free plan.
  * Safely cleans up all created subscriptions and deletes the test customer.

---

## 📊 Integration Test Verification Report

Executing `node scripts/test-billing-routes.js` gives:

```text
🧪 Starting Usage & Billing Routes Integration Tests...
📡 Temporary billing test server listening on port 4006

[Setup] Registering test user...
✅ User registered. External Customer ID: user_7gqmUIgUmChy

Test 1: Fetching usage dashboard data on Free plan...
Result Status: 200
✅ Correctly verified initial Free plan usage metrics.

Test 2: Requesting plan upgrade to Pro Plan...
Result Status: 200
✅ Correctly initiated subscription upgrade.

Test 3: Fetching usage dashboard data after Pro upgrade...
Result Status: 200
✅ Correctly verified upgraded Pro plan usage metrics.

Test 4: Requesting plan downgrade to Free Plan...
Result Status: 200
✅ Correctly initiated subscription downgrade.

Test 5: Fetching usage dashboard data after Free downgrade...
Result Status: 200
✅ Correctly verified downgraded Free plan usage metrics.

🧹 Cleaning up test customer data from Flexprice...
✅ Cleanup completed.

🎉 ALL USAGE & BILLING ROUTE INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉
📡 Test server shut down.
```
