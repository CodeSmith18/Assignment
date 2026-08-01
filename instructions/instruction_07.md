# Step 7: Text Processing Routes
## Implementation Instructions for TextFlow SaaS

### Overview
This step implements the core text processing routes that integrate all previous components into the main SaaS functionality. The routes combine authentication, entitlement checking, AI processing, and usage tracking to provide the complete user workflow that generates revenue through plan limits and premium features.

---

## Part A: Main Text Processing Route

### 1. Create Text Processing Routes Module
**File:** `textflow/server/src/routes/text.js`

**Core Purpose:**
- Provide the main `/api/process` endpoint for text summarization and rewriting
- Integrate authentication, entitlement checking, AI processing, and usage tracking
- Handle the complete workflow from user request to Flexprice event ingestion
- Return comprehensive responses including both AI results and usage updates
- Maintain operation history for user dashboard display

**Route Architecture:**
- Single primary endpoint with operation type parameter
- Complete error handling for each workflow step
- Structured JSON responses for frontend consumption
- Integration with all service layers from previous steps

---

## Part B: Core Processing Endpoint Implementation

### 2. Implement POST /api/process
**Purpose:** The main metered action that users pay for - text summarization and rewriting

**Request Format:**
```javascript
{
  "text": "Text content to process...",
  "operation": "summarize" | "rewrite",
  "tone": "default" | "professional" | "casual" | "academic" | "creative", // optional, Pro only
  "options": {} // optional future parameters
}
```

**Implementation Workflow:**

#### Step 1: Authentication & Input Validation
- Use `requireAuth` middleware to ensure user is authenticated
- Validate request body structure and required fields
- Sanitize and validate text input
- Validate operation type and tone parameter

#### Step 2: Entitlement Checking
- Check usage quota using `checkUsageQuota()` from entitlement service
- If tone is specified and not 'default', check tone feature access
- Return 402 Payment Required with upgrade messaging if blocked
- Include current usage information in blocking responses

#### Step 3: AI Processing
- Call appropriate AI service function (`summarize()` or `rewrite()`)
- Pass user's plan information for input length validation
- Handle AI service errors gracefully
- Preserve original user input if AI processing fails

#### Step 4: Usage Event Ingestion
- Generate unique event ID for this operation
- Ingest event to Flexprice using `ingestEvent()` function
- Include character count and operation metadata
- Log event ingestion for debugging but don't block on failure

#### Step 5: Operation History Storage
- Store operation details in local database for UI history
- Include input preview (truncated), output preview, and metadata
- Link to Flexprice event ID for traceability
- Handle database errors gracefully

#### Step 6: Response Compilation
- Combine AI processing result with updated usage information
- Fetch fresh usage data after event ingestion
- Return comprehensive response for frontend consumption

**Response Format:**
```javascript
// Success case
{
  "success": true,
  "operation": "summarize",
  "result": {
    "summary": "Generated summary text...",
    "originalLength": 1500,
    "summaryLength": 250,
    "compressionRatio": 0.17,
    "model": "facebook/bart-large-cnn",
    "processingTime": 2.3
  },
  "usage": {
    "charactersProcessed": {
      "current": 1750,
      "limit": 2000,
      "remaining": 250,
      "percent": 87.5
    }
  },
  "eventId": "evt_abc123",
  "plan": "free"
}

// Quota exceeded case
{
  "success": false,
  "blocked": true,
  "reason": "quota_exceeded",
  "message": "You've reached your monthly character limit of 2,000. Upgrade to Pro for 50,000 characters/month.",
  "usage": {
    "charactersProcessed": {
      "current": 1950,
      "limit": 2000,
      "remaining": 50,
      "percent": 97.5
    }
  },
  "upgradeRequired": true,
  "plan": "free"
}

// Feature locked case
{
  "success": false,
  "blocked": true,
  "reason": "feature_locked",
  "message": "Tone selection is available on Pro plans. Upgrade to access advanced rewriting options.",
  "feature": "tone_selector",
  "requestedTone": "professional",
  "upgradeRequired": true,
  "plan": "free"
}
```

---

## Part C: Operation History Management

### 3. Implement Operation History Tracking
**Purpose:** Store user operations for dashboard display and usage analytics

**Database Operations:**
- Create operation record with input/output previews
- Link to Flexprice event ID for audit trail
- Truncate long inputs/outputs for storage efficiency
- Handle concurrent operations correctly

**Implementation Requirements:**

#### Database Integration
```javascript
import { getDatabase, runQuery } from '../db/init.js';

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
      operationData.inputPreview.substring(0, 200), // Truncate for storage
      operationData.outputPreview.substring(0, 200),
      operationData.flexpriceEventId
    ];
    
    const result = await runQuery(db, sql, params);
    return result.id;
  } finally {
    db.close();
  }
}
```

#### Preview Generation
- Input preview: First 200 characters with ellipsis if longer
- Output preview: First 200 characters of result with ellipsis
- Preserve formatting where possible for UI display

---

## Part D: Error Handling & Resilience

### 4. Implement Comprehensive Error Handling
**Requirements:**

#### Workflow Error Scenarios
1. **Authentication Failure:** Return 401 Unauthorized
2. **Input Validation Failure:** Return 400 Bad Request with specific validation errors
3. **Quota Exceeded:** Return 402 Payment Required with usage info and upgrade prompt
4. **Feature Locked:** Return 402 Payment Required with feature info and upgrade prompt
5. **AI Service Failure:** Return 503 Service Unavailable with retry suggestion
6. **Flexprice Event Ingestion Failure:** Log error but continue (don't block user)
7. **Database Storage Failure:** Log error but continue (don't block user)

#### Error Response Standardization
```javascript
// Standardized error response structure
{
  "success": false,
  "error": {
    "code": "QUOTA_EXCEEDED" | "FEATURE_LOCKED" | "VALIDATION_ERROR" | "SERVICE_UNAVAILABLE",
    "message": "User-friendly error message",
    "details": {} // Additional context for debugging
  },
  "usage": {}, // Current usage info when relevant
  "upgradeRequired": boolean, // When user should upgrade to resolve
  "retryable": boolean // Whether user should retry the operation
}
```

#### Graceful Degradation Strategy
- **AI Service Failures:** Return fallback results with clear indication
- **Flexprice API Failures:** Continue with operation but log for follow-up
- **Database Failures:** Complete operation but log storage failure
- **Partial Failures:** Provide partial results rather than complete failure

---

## Part E: Usage Data Integration

### 5. Implement Real-Time Usage Updates
**Purpose:** Provide immediate feedback on usage consumption after processing

**Implementation Requirements:**

#### Post-Processing Usage Fetch
```javascript
// After successful AI processing and event ingestion
async function getUpdatedUsage(externalCustomerId) {
  try {
    // Wait briefly for Flexprice to process the event
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const usageData = await getCurrentUsage(externalCustomerId);
    return usageData.usage.charactersProcessed;
  } catch (error) {
    console.error('[Text Route] Failed to fetch updated usage:', error);
    // Return estimated usage based on previous + current operation
    return estimateUsage(previousUsage, currentCharCount);
  }
}
```

#### Usage Estimation Fallback
- Calculate estimated usage if Flexprice data unavailable
- Use previous known usage + current operation character count
- Provide reasonable approximation for UI updates
- Mark as estimated in response for frontend handling

---

## Part F: Performance Optimization

### 6. Implement Performance Enhancements
**Requirements:**

#### Request Processing Optimization
- **Parallel Operations:** Fetch user plan and usage data in parallel where possible
- **Early Validation:** Fail fast on input validation before expensive operations
- **Efficient Database Operations:** Use prepared statements and connection pooling
- **Response Streaming:** Consider streaming for large text operations (future)

#### Monitoring and Metrics
```javascript
// Track route performance
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
  
  // Track specific error types
  if (errorType === 'quota_exceeded') routeMetrics.quotaBlocks++;
  if (errorType === 'feature_locked') routeMetrics.featureBlocks++;
  if (errorType === 'ai_service_error') routeMetrics.aiServiceErrors++;
  if (errorType === 'flexprice_error') routeMetrics.flexpriceErrors++;
  
  // Update rolling average processing time
  routeMetrics.averageProcessingTime = 
    (routeMetrics.averageProcessingTime * 0.9) + (processingTime * 0.1);
}
```

---

## Part G: Integration Testing

### 7. Comprehensive End-to-End Testing
**File:** `textflow/server/scripts/test-text-processing-routes.js`

**Test Requirements:**

#### Authentication Integration Tests
- Test with valid authenticated session
- Test with invalid/missing authentication
- Verify user context is properly passed through workflow

#### Entitlement Integration Tests
- Test Free user within quota limits
- Test Free user exceeding quota limits
- Test Free user attempting tone selection (should be blocked)
- Test Pro user with higher limits and tone access
- Test Pro user exceeding their higher limits

#### AI Service Integration Tests
- Test successful summarization workflow
- Test successful rewriting workflow with different tones
- Test AI service failure scenarios and fallbacks
- Verify response format consistency

#### Flexprice Integration Tests
- Test event ingestion after successful operations
- Test event ingestion failure handling (should not block user)
- Verify event data matches operation parameters
- Test usage data retrieval after event ingestion

#### Database Integration Tests
- Test operation history storage
- Test database failure graceful handling
- Verify operation data persistence

#### Complete Workflow Tests
```javascript
// Test successful summarization workflow
async function testSummarizationWorkflow() {
  const testUser = await createTestUser('free');
  const authToken = await getAuthToken(testUser);
  
  const response = await request(app)
    .post('/api/process')
    .set('Authorization', `Bearer ${authToken}`)
    .send({
      text: 'This is a test article that needs to be summarized...',
      operation: 'summarize'
    });
    
  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(response.body.result.summary).toBeDefined();
  expect(response.body.usage.charactersProcessed.current).toBeGreaterThan(0);
  expect(response.body.eventId).toBeDefined();
}
```

---

## Part H: Route Configuration & Server Integration

### 8. Server Integration
**Update:** `textflow/server/src/server.js`

**Mount the text processing routes:**
```javascript
import textRoutes from './routes/text.js';

// Mount text processing routes (protected by authentication)
app.use('/api/process', requireAuth, textRoutes);
```

### 9. Rate Limiting (Optional but Recommended)
**Implementation Requirements:**
- Implement rate limiting per user for text processing operations
- Different limits for Free vs Pro users (e.g., Free: 10 requests/hour, Pro: 100 requests/hour)
- Return 429 Too Many Requests with retry-after header
- Consider operation complexity in rate limiting (longer text = higher cost)

---

## Implementation Guidelines

### Workflow Integration Patterns
- **Always validate early:** Check authentication and input before expensive operations
- **Fail gracefully:** Provide meaningful fallbacks when possible
- **Log comprehensively:** Track all steps for debugging and analytics
- **Return rich data:** Include usage updates and context for frontend
- **Handle async carefully:** Ensure proper error handling in async workflows

### Error Communication Strategy
- **Be specific but secure:** Provide helpful errors without exposing internals
- **Include upgrade paths:** Always show clear next steps for blocked users
- **Maintain consistency:** Use standardized error response formats
- **Log for operations:** Capture details for debugging while returning user-friendly messages

### Performance Considerations
- **Optimize hot paths:** The text processing route will be heavily used
- **Cache when appropriate:** Consider caching user plan information briefly
- **Monitor performance:** Track processing times and error rates
- **Plan for scale:** Consider database connection pooling and query optimization

---

## Verification Checklist

**Before proceeding to Step 8, ensure:**
- [ ] Main text processing endpoint is implemented and tested
- [ ] Authentication integration works correctly with user context
- [ ] Entitlement checking properly enforces quota and feature limits
- [ ] AI service integration handles both success and failure cases
- [ ] Flexprice event ingestion tracks usage correctly
- [ ] Operation history storage provides audit trail
- [ ] Error handling covers all failure scenarios with appropriate responses
- [ ] Performance monitoring tracks key metrics
- [ ] End-to-end tests validate complete workflow
- [ ] Response formats are consistent and frontend-ready

---

## Common Pitfalls to Avoid

1. **Blocking on Non-Critical Failures:** Don't fail user operations due to Flexprice or database issues
2. **Inconsistent Error Responses:** Maintain consistent response structure across all error cases
3. **Missing Usage Updates:** Always return current usage information after successful operations
4. **Poor Error Messages:** Provide actionable error messages with clear upgrade paths
5. **Authentication Bypass:** Ensure all routes properly validate authentication
6. **Double Event Ingestion:** Avoid sending duplicate events to Flexprice
7. **Memory Leaks:** Properly close database connections and clean up resources

---

## Testing Strategy

### Unit Testing
- Test each workflow step in isolation
- Mock external dependencies (AI service, Flexprice, database)
- Verify error handling for each step
- Test response format consistency

### Integration Testing
- Test complete workflows with real dependencies
- Verify authentication and entitlement integration
- Test AI service and Flexprice integration
- Validate operation history storage

### End-to-End Testing
- Test complete user journey from authentication through processing
- Test upgrade scenarios (Free user hitting limits)
- Test error scenarios and recovery
- Validate frontend integration points

---

## Next Step Preview

**Step 8** will implement the usage and billing routes that provide dashboard data and plan management functionality. These routes will use the operation history created here and provide the user interface for monitoring usage and upgrading plans.

The text processing route you build in this step is the core revenue-generating functionality of TextFlow - it's where users consume their quota and encounter upgrade prompts that drive plan conversions.