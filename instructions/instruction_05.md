# Step 5: Entitlement Service & Usage Checking
## Implementation Instructions for TextFlow SaaS

### Overview
This step implements the core business logic layer that enforces plan limits and feature access. The entitlement service acts as the bridge between user authentication and the actual SaaS functionality, checking Flexprice entitlements in real-time to enforce usage quotas and gate premium features.

---

## Part A: Core Entitlement Service

### 1. Create Entitlement Service Module
**File:** `textflow/server/src/services/entitlementService.js`

**Core Purpose:**
- Centralize all business logic for plan enforcement
- Provide clean, normalized responses for route handlers
- Abstract Flexprice API complexity from application routes
- Handle error scenarios gracefully with user-friendly messages

**Module Architecture:**
- Export individual functions (not a class)
- Each function should be stateless and focused on a single concern
- Use the Flexprice client modules from Step 2
- Return consistent response objects with success/error states

---

## Part B: Usage Quota Checking

### 2. Implement Usage Quota Validation
**Function:** `checkUsageQuota(externalCustomerId, incomingCharacterCount)`

**Purpose:** Verify if a user can process additional text without exceeding their plan limits

**Implementation Requirements:**

#### Input Parameters
- `externalCustomerId` - The user's external customer ID for Flexprice lookup
- `incomingCharacterCount` - How many characters the user wants to process

#### Core Logic Flow
1. **Get Customer Entitlements** - Use `getCustomerEntitlements()` from Step 2
2. **Find Characters Feature** - Locate the "Characters Processed" feature in entitlements
3. **Get Current Usage** - Use `getCustomerUsage()` to get live usage data from Flexprice
4. **Calculate Available Quota** - Compare current usage + incoming against limit
5. **Return Decision** - Allow/deny with detailed reasoning

#### Response Format
```javascript
// Success case
{
  allowed: true,
  usage: {
    current: 1500,
    limit: 2000,
    remaining: 500,
    percent: 75,
    afterProcessing: 1750
  },
  plan: "free"
}

// Quota exceeded case
{
  allowed: false,
  reason: "quota_exceeded",
  message: "You've reached your monthly character limit of 2,000. Upgrade to Pro for 50,000 characters/month.",
  usage: {
    current: 1950,
    limit: 2000,
    remaining: 50,
    percent: 97.5,
    afterProcessing: 2200 // Would exceed
  },
  plan: "free",
  upgradeRequired: true
}

// Error case
{
  allowed: false,
  reason: "entitlement_check_failed", 
  message: "Unable to verify account limits. Please try again.",
  error: "Network timeout"
}
```

#### Error Handling Requirements
- **Flexprice API Failures:** Return `entitlement_check_failed` but don't block user (fail open for better UX)
- **Missing Entitlements:** Return `configuration_error` - this indicates seeding issues
- **Invalid Customer:** Return `customer_not_found` - may indicate authentication issues
- **Network Timeouts:** Return temporary error with retry suggestion

### 3. Usage Data Aggregation
**Implementation Requirements:**

#### Feature Identification
- Use the `CHAR_FEATURE_ID` environment variable to identify the characters feature
- Handle cases where the feature might not be found in entitlements
- Support multiple feature types (focus on metered features for this function)

#### Usage Calculation
- Extract `current_usage` from Flexprice FeatureUsageSummary response
- Handle string/numeric conversion (Flexprice returns usage as strings)
- Calculate percentage: `(current_usage / total_limit) * 100`
- Project usage after processing: `current_usage + incomingCharacterCount`

---

## Part C: Boolean Feature Checking

### 4. Implement Feature Gate Validation  
**Function:** `checkBooleanFeature(externalCustomerId, featureName)`

**Purpose:** Verify if a user has access to premium features like tone selection

**Implementation Requirements:**

#### Input Parameters
- `externalCustomerId` - The user's external customer ID
- `featureName` - Feature to check ("tone_selector" for the tone feature)

#### Core Logic Flow
1. **Get Customer Entitlements** - Same as quota checking
2. **Find Boolean Feature** - Locate the specified feature in entitlements
3. **Check Enabled State** - Read the `is_enabled` property
4. **Return Access Decision** - Allow/deny with feature context

#### Response Format
```javascript
// Feature enabled (Pro user)
{
  hasAccess: true,
  feature: "tone_selector",
  plan: "pro",
  enabled: true
}

// Feature disabled (Free user)  
{
  hasAccess: false,
  feature: "tone_selector", 
  plan: "free",
  enabled: false,
  message: "Tone selection is available on Pro plans. Upgrade to access advanced rewriting options.",
  upgradeRequired: true
}

// Error case
{
  hasAccess: false,
  feature: "tone_selector",
  reason: "entitlement_check_failed",
  message: "Unable to verify feature access. Please try again."
}
```

#### Feature Name Mapping
- Create a mapping between feature names and environment variable IDs:
```javascript
const FEATURE_MAPPING = {
  'tone_selector': process.env.TONE_FEATURE_ID,
  'characters_processed': process.env.CHAR_FEATURE_ID
};
```

---

## Part D: Current Usage Retrieval

### 5. Implement Usage Dashboard Data
**Function:** `getCurrentUsage(externalCustomerId)`

**Purpose:** Get comprehensive usage data for dashboard display

**Implementation Requirements:**

#### Response Format
```javascript
{
  success: true,
  usage: {
    charactersProcessed: {
      current: 1500,
      limit: 2000,
      remaining: 500,
      percent: 75,
      resetDate: "2026-09-01T00:00:00Z"
    }
  },
  features: {
    toneSelector: {
      enabled: false,
      available: false // false for Free, true for Pro
    }
  },
  plan: {
    name: "free",
    displayName: "Free",
    limits: {
      charactersPerMonth: 2000
    }
  },
  subscription: {
    id: "subs_abc123",
    status: "active",
    currentPeriodStart: "2026-08-01T00:00:00Z",
    currentPeriodEnd: "2026-09-01T00:00:00Z"
  }
}
```

#### Data Aggregation Logic
- Combine entitlements and usage data into a single comprehensive response
- Include billing period information for usage reset dates
- Provide feature availability status for UI rendering
- Handle missing or incomplete data gracefully

---

## Part E: Integration Patterns

### 6. Authentication Integration
**Implementation Requirements:**

#### Middleware Integration Pattern
```javascript
// In route handlers
app.post('/api/process', requireAuth, async (req, res) => {
  const { text, tone } = req.body;
  
  // Use req.user.external_customer_id from auth middleware
  const quotaCheck = await checkUsageQuota(req.user.external_customer_id, text.length);
  
  if (!quotaCheck.allowed) {
    return res.status(402).json({
      success: false,
      blocked: true,
      reason: quotaCheck.reason,
      message: quotaCheck.message,
      usage: quotaCheck.usage
    });
  }
  
  if (tone && tone !== 'default') {
    const featureCheck = await checkBooleanFeature(req.user.external_customer_id, 'tone_selector');
    if (!featureCheck.hasAccess) {
      return res.status(402).json({
        success: false,
        blocked: true,
        reason: 'feature_locked',
        message: featureCheck.message
      });
    }
  }
  
  // Proceed with text processing...
});
```

### 7. Error Response Standardization
**Implementation Requirements:**

#### Consistent Error Codes
- `quota_exceeded` - User has hit their usage limit
- `feature_locked` - User doesn't have access to requested feature
- `entitlement_check_failed` - Flexprice API error
- `customer_not_found` - Authentication/customer mapping issue
- `configuration_error` - Missing features/plans (seeding issue)

#### HTTP Status Code Mapping
- `402 Payment Required` - Quota exceeded or feature locked (upgrades available)
- `503 Service Unavailable` - Flexprice API temporarily unavailable
- `500 Internal Server Error` - Configuration errors or unexpected failures
- `401 Unauthorized` - Customer not found (authentication issue)

---

## Part F: Caching and Performance

### 8. Entitlement Caching Strategy
**Implementation Requirements:**

#### Simple In-Memory Caching (Optional)
- Cache entitlements for 5 minutes to reduce Flexprice API calls
- Use user's external_customer_id as cache key
- Invalidate cache on plan changes or errors
- Keep cache size reasonable (limit to 1000 entries)

#### Cache Implementation Pattern
```javascript
const entitlementCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedEntitlements(externalCustomerId) {
  const cacheKey = `entitlements:${externalCustomerId}`;
  const cached = entitlementCache.get(cacheKey);
  
  if (cached && cached.timestamp > Date.now() - CACHE_TTL) {
    return cached.data;
  }
  
  const fresh = await getCustomerEntitlements(externalCustomerId);
  entitlementCache.set(cacheKey, {
    data: fresh,
    timestamp: Date.now()
  });
  
  return fresh;
}
```

**Note:** Implement caching only if performance testing shows it's needed. Start without caching for simplicity.

---

## Part G: Testing and Validation

### 9. Entitlement Service Testing
**File:** `textflow/server/scripts/test-entitlement-service.js`

**Test Requirements:**

#### Test Scenarios
1. **Quota Checking Tests:**
   - User within limits (should allow)
   - User at exact limit (should deny)
   - User over limit (should deny)
   - Invalid customer ID (should error gracefully)
   - Flexprice API failure (should fail open or return error)

2. **Feature Access Tests:**
   - Free user accessing tone selector (should deny)
   - Pro user accessing tone selector (should allow)
   - Non-existent feature (should error)

3. **Usage Data Tests:**
   - Complete usage dashboard data
   - Missing entitlement data
   - Invalid subscription status

#### Test Implementation Strategy
- Create test customers with known usage patterns
- Test against your seeded Free and Pro plans
- Verify error handling with invalid inputs
- Test edge cases (exactly at limits, zero usage)

### 10. Integration with Authentication
**Test Requirements:**

#### End-to-End Integration Testing
- Test with real authenticated users from Step 4
- Verify external_customer_id mapping works correctly
- Test session-based entitlement checking
- Validate that plan upgrades reflect immediately in entitlements

---

## Implementation Guidelines

### Flexprice API Usage Patterns
- **Always use live data** - Never cache usage numbers, always fetch fresh from Flexprice
- **Handle API failures gracefully** - Don't block users on temporary Flexprice issues
- **Use environment variables** - Reference seeded entity IDs from environment
- **Log important decisions** - Log quota blocks and feature access denials for analytics

### Error Handling Philosophy
- **Fail open when possible** - If entitlement check fails, consider allowing the action with a warning
- **Be specific in errors** - Help users understand what they need to do (upgrade, wait, retry)
- **Log all errors** - Capture details for debugging but return user-friendly messages
- **Provide upgrade paths** - Always include clear next steps for blocked users

### Response Object Design
- **Consistent structure** - All functions return similar response shapes
- **Include context** - Provide enough information for UI to render appropriately
- **Be explicit** - Include both machine-readable flags and human-readable messages
- **Plan for frontend** - Structure responses for easy consumption by React components

---

## Verification Checklist

**Before proceeding to Step 6, ensure:**
- [ ] All three main functions are implemented and tested
- [ ] Quota checking works with various usage scenarios
- [ ] Boolean feature checking correctly gates premium features
- [ ] Usage dashboard data provides comprehensive information
- [ ] Error handling covers all failure scenarios
- [ ] Integration with authentication middleware works seamlessly
- [ ] Test script validates all functionality against live Flexprice data
- [ ] Responses are properly structured for frontend consumption

---

## Common Pitfalls to Avoid

1. **Caching Usage Data:** Don't cache current usage - always fetch live from Flexprice
2. **Hardcoding Limits:** Use entitlement data, not hardcoded plan limits
3. **Blocking on API Failures:** Consider failing open for better user experience
4. **Inconsistent Error Responses:** Maintain consistent response structure across all functions
5. **Missing Feature IDs:** Always validate environment variables are set and valid
6. **String/Number Confusion:** Handle Flexprice's string-based usage values correctly

---

## Testing Strategy

### Unit Testing
- Test each function in isolation with mock Flexprice responses
- Verify edge cases (zero usage, exactly at limit, over limit)
- Test error scenarios and error response formatting

### Integration Testing  
- Test with real authenticated users and live Flexprice data
- Verify that plan changes are reflected immediately
- Test across different user states (Free vs Pro)

### Performance Testing
- Measure response times for entitlement checks
- Test under concurrent load (multiple users checking simultaneously)
- Validate that Flexprice API calls don't become a bottleneck

---

## Next Step Preview

**Step 6** will implement the AI service that uses these entitlement checks to enforce plan-based access to different text processing features. The entitlement service you build here will be called before every AI operation to ensure users stay within their limits and only access features they're entitled to.

The business logic layer you create in this step is the foundation that makes TextFlow a true SaaS application with enforceable plan limits and premium feature gating.