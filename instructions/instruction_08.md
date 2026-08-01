# Step 8: Usage & Billing Routes
## Implementation Instructions for TextFlow SaaS

### Overview
This step implements the usage tracking and subscription billing routes. These routes supply the React frontend dashboard with real-time usage metrics, operation history logs, next billing cycle information, and options to upgrade or downgrade subscription plans.

---

## Part A: Usage Router Implementation

### 1. Create Usage Routes Module
**File:** `textflow/server/src/routes/usage.js`

**Core Purpose:**
- Provide `GET /api/usage` for fetching current usage summaries and operation histories.
- Read real-time billing limits, current usage amounts, and feature gates directly from Flexprice (not local cache).
- Read operation histories from SQLite.

**Implementation Details:**
- **Route:** `GET /` (mounted at `/api/usage`)
- **Authentication:** Protected by `requireAuth` middleware.
- **Workflow:**
  1. Retrieve `user.external_customer_id` from session.
  2. Call `getCurrentUsage(externalCustomerId)` from `entitlementService.js` to fetch live Flexprice subscription status, metered limits, and premium features lock status.
  3. Query the local SQLite database for the user's operation history (table `operations`), ordered by `created_at` descending. Support optional query parameters `limit` (default: 10) and `offset` (default: 0) for pagination.
  4. Return a structured JSON response combining Flexprice data, SQLite operation records, and billing period reset dates.

**Response Payload Format:**
```json
{
  "success": true,
  "plan": {
    "name": "free",
    "displayName": "Free",
    "limits": {
      "charactersPerMonth": 2000
    }
  },
  "usage": {
    "charactersProcessed": {
      "current": 1500,
      "limit": 2000,
      "remaining": 500,
      "percent": 75.0,
      "resetDate": "2026-09-01T16:09:56Z"
    }
  },
  "features": {
    "toneSelector": {
      "enabled": false,
      "available": false
    }
  },
  "subscription": {
    "id": "subs_abc123",
    "status": "active",
    "currentPeriodStart": "2026-08-01T16:09:56Z",
    "currentPeriodEnd": "2026-09-01T16:09:56Z"
  },
  "history": [
    {
      "id": 1,
      "operation_type": "summarize",
      "tone": null,
      "input_chars": 150,
      "input_preview": "The quick brown fox...",
      "output_preview": "Rewritten fox text...",
      "flexprice_event_id": "evt_xyz789",
      "created_at": "2026-08-01T17:00:00.000Z"
    }
  ]
}
```

---

## Part B: Billing Router Implementation

### 2. Create Billing Routes Module
**File:** `textflow/server/src/routes/billing.js`

**Core Purpose:**
- Provide endpoints to upgrade or downgrade subscription plans.
- Communicate plan changes directly to Flexprice.

**Implementation Details:**
- **Upgrade Route:** `POST /upgrade` (mounted at `/api/billing/upgrade`)
  - **Authentication:** Protected by `requireAuth`.
  - **Workflow:**
    1. Retrieve the active customer subscription by querying `GET /customers/external/{id}/subscriptions` on Flexprice.
    2. Extract the active subscription ID. If none is active, return `404 Not Found`.
    3. Transition the subscription to the Pro plan using `changeSubscriptionPlan(subscriptionId, config.proPlanId)`.
    4. Return `200 OK` with subscription details.
- **Downgrade Route:** `POST /downgrade` (mounted at `/api/billing/downgrade`)
  - **Authentication:** Protected by `requireAuth`.
  - **Workflow:**
    1. Retrieve the active customer subscription from Flexprice.
    2. Extract the active subscription ID. If none is active, return `404 Not Found`.
    3. Transition the subscription to the Free plan using `changeSubscriptionPlan(subscriptionId, config.freePlanId)`.
    4. Return `200 OK` with subscription details.

**Response Payload Format:**
```json
{
  "success": true,
  "message": "Subscription updated successfully.",
  "subscription": {
    "id": "subs_pro123",
    "planId": "plan_01KYYZBBVXTGX63NK38BXCXP2G",
    "status": "active"
  }
}
```

---

## Part C: Server Integration

### 3. Mount Routes in `server.js`
**File:** `textflow/server/src/server.js`

Add the following mounts:
```javascript
import usageRoutes from './routes/usage.js';
import billingRoutes from './routes/billing.js';

// Mount usage routes (protected by authentication)
app.use('/api/usage', requireAuth, usageRoutes);

// Mount billing routes (protected by authentication)
app.use('/api/billing', requireAuth, billingRoutes);
```

---

## Part D: End-to-End Testing

### 4. Create Billing & Usage Test Script
**File:** `textflow/server/scripts/test-billing-routes.js`

**Test Requirements:**
1. Spin up a temporary Express test server running on port `4006`.
2. Register a test user (which provisions a Free subscription on Flexprice).
3. Fetch dashboard data via `GET /api/usage` and verify that the plan returns `'free'`, the limit is `2000`, the tone selector is disabled, and history includes signup/initial state.
4. Execute `POST /api/billing/upgrade`. Verify that subscription transitions successfully.
5. Fetch dashboard data via `GET /api/usage` and verify that the plan returned is now `'pro'`, the limits are updated (>= 50,000), and the tone selector is active.
6. Execute `POST /api/billing/downgrade`. Verify that subscription transitions back to the Free plan.
7. Verify that dashboard data returns `'free'` again.
8. Perform dynamic teardown cleanup (cancel subscriptions and delete test customer).
