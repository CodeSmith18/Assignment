# Step 6: AI Service Integration
## Implementation Instructions for TextFlow SaaS

### Overview
This step implements the AI service that provides the core text processing functionality using Hugging Face APIs. The service integrates with the entitlement system from Step 5 to enforce plan limits and provides the actual value proposition of TextFlow: AI-powered text summarization and rewriting with premium tone options.

---

## Part A: AI Service Foundation

### 1. Create AI Service Module
**File:** `textflow/server/src/services/aiService.js`

**Core Purpose:**
- Provide text summarization using Hugging Face models
- Provide text rewriting with optional tone adjustment
- Handle API failures and rate limiting gracefully
- Integrate with plan-based feature restrictions
- Return consistent response formats for route handlers

**Module Architecture:**
- Export individual async functions (not a class)
- Each function should handle retries and error recovery
- Use environment variables for API configuration
- Implement input validation and sanitization

---

## Part B: Text Summarization Implementation

### 2. Implement Text Summarization
**Function:** `summarize(text, options = {})`

**Purpose:** Generate concise summaries of input text using Hugging Face's BART model

**Implementation Requirements:**

#### Hugging Face API Integration
- **Model:** `facebook/bart-large-cnn` (optimized for summarization)
- **Endpoint:** `https://api-inference.huggingface.co/models/facebook/bart-large-cnn`
- **Authentication:** Bearer token from `HUGGINGFACE_API_TOKEN` environment variable
- **Request Format:** `{ "inputs": "text to summarize" }`

#### Input Validation
- Minimum text length: 50 characters (too short to summarize meaningfully)
- Maximum text length: 8,000 characters for Pro users, 1,000 for Free users
- Text sanitization: trim whitespace, remove excessive line breaks
- Content filtering: reject empty or non-text inputs

#### Request Configuration
```javascript
{
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.HUGGINGFACE_API_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    inputs: text,
    parameters: {
      max_length: Math.min(150, Math.floor(text.length * 0.3)), // ~30% of original length
      min_length: 30,
      do_sample: false
    }
  })
}
```

#### Response Handling
- **Success:** Extract `summary_text` from Hugging Face response array
- **Rate Limited:** Detect 429/503 responses and implement retry with exponential backoff
- **Model Loading:** Handle 503 responses for cold model startup (retry after 10-20 seconds)
- **Invalid Input:** Handle 400 responses with helpful error messages

#### Error Recovery Strategy
- **Retry Logic:** Up to 3 retries with exponential backoff (2s, 4s, 8s)
- **Fallback Response:** If all retries fail, return extractive summary (first + middle + last sentences)
- **Timeout Handling:** 30-second timeout for each API call

#### Response Format
```javascript
// Success case
{
  success: true,
  summary: "Generated summary text...",
  originalLength: 1500,
  summaryLength: 250,
  compressionRatio: 0.17,
  model: "facebook/bart-large-cnn",
  processingTime: 2.3
}

// Fallback case
{
  success: true,
  summary: "Extractive fallback summary...", 
  fallback: true,
  reason: "huggingface_api_unavailable",
  originalLength: 1500,
  summaryLength: 200,
  processingTime: 0.1
}

// Error case
{
  success: false,
  error: "text_too_short",
  message: "Text must be at least 50 characters to summarize effectively.",
  originalLength: 25
}
```

---

## Part C: Text Rewriting Implementation

### 3. Implement Text Rewriting
**Function:** `rewrite(text, tone = 'default', options = {})`

**Purpose:** Paraphrase text with optional tone adjustment for Pro users

**Implementation Requirements:**

#### Model Selection Strategy
- **Basic Rewriting:** `t5-base` model for general paraphrasing
- **Tone Adjustment:** Use prompt-based approach with `t5-base` or `google/flan-t5-base`
- **Endpoint:** `https://api-inference.huggingface.co/models/t5-base`

#### Tone Options (Pro Feature)
- `'professional'` - Formal business language, avoid contractions
- `'casual'` - Conversational tone, use contractions, friendly language
- `'academic'` - Scholarly tone, precise terminology, formal structure
- `'creative'` - Engaging, varied sentence structure, descriptive language

#### Prompt Engineering for Tones
```javascript
const TONE_PROMPTS = {
  'default': 'Rewrite the following text: ',
  'professional': 'Rewrite the following text in a professional business tone: ',
  'casual': 'Rewrite the following text in a casual, conversational tone: ',
  'academic': 'Rewrite the following text in an academic, scholarly tone: ',
  'creative': 'Rewrite the following text in a creative, engaging tone: '
};

const prompt = `${TONE_PROMPTS[tone] || TONE_PROMPTS.default}${text}`;
```

#### T5 Model Configuration
```javascript
{
  inputs: `${prompt}${text}`,
  parameters: {
    max_length: Math.min(512, text.length + 50), // Allow for slight expansion
    min_length: Math.max(10, Math.floor(text.length * 0.8)), // Maintain most content
    do_sample: true,
    temperature: 0.7,
    num_return_sequences: 1
  }
}
```

#### Input Validation for Rewriting
- Minimum text length: 10 characters
- Maximum text length: 8,000 characters for Pro users, 1,000 for Free users
- Tone validation: ensure tone is in allowed list or default to 'default'
- Content filtering: basic profanity/spam detection (optional)

#### Response Format
```javascript
// Success case
{
  success: true,
  rewrittenText: "Rewritten content...",
  originalText: "Original content...",
  tone: "professional",
  originalLength: 150,
  rewrittenLength: 165,
  model: "t5-base",
  processingTime: 1.8
}

// Tone feature locked case (handled by route, not AI service)
{
  success: false,
  error: "tone_feature_locked",
  message: "Tone selection is available on Pro plans. Upgrade to access advanced rewriting options."
}
```

---

## Part D: Error Handling & Resilience

### 4. Implement Robust Error Handling
**Requirements:**

#### Hugging Face API Error Scenarios
- **429 Rate Limited:** Retry with exponential backoff
- **503 Service Unavailable:** Model loading, wait and retry
- **400 Bad Request:** Invalid input, return user-friendly error
- **401 Unauthorized:** API key issue, log error and return service unavailable
- **500 Internal Server Error:** Temporary failure, retry once

#### Network Error Handling
- **Timeout:** 30-second timeout per request
- **Connection Refused:** Network issue, return service unavailable
- **DNS Resolution:** Network configuration issue

#### API Response Validation
- **Validate Response Structure:** Ensure expected fields are present
- **Content Quality Checks:** Verify output isn't empty or malformed
- **Length Validation:** Ensure output meets minimum quality thresholds

#### Fallback Strategies
```javascript
// Extractive summarization fallback
function extractiveSummary(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length <= 3) return text;
  
  const firstSentence = sentences[0];
  const middleSentence = sentences[Math.floor(sentences.length / 2)];
  const lastSentence = sentences[sentences.length - 1];
  
  return `${firstSentence}. ${middleSentence}. ${lastSentence}.`.trim();
}

// Simple rewriting fallback
function basicRewrite(text) {
  // Simple synonym replacement or sentence restructuring
  // This is a minimal fallback - in production you might use a local NLP library
  return text.replace(/\b(very|really|extremely)\s+/gi, 'considerably ')
             .replace(/\b(good)\b/gi, 'excellent')
             .replace(/\b(bad)\b/gi, 'problematic');
}
```

---

## Part E: Performance & Rate Limiting

### 5. Implement Performance Optimizations
**Requirements:**

#### Request Optimization
- **Input Preprocessing:** Trim and clean text before sending to API
- **Smart Batching:** For future bulk operations (not required for MVP)
- **Response Caching:** Cache results for identical inputs (5-minute TTL)

#### Rate Limiting Management
- **Exponential Backoff:** 2^retry_count seconds with jitter
- **Request Queuing:** Simple queue for handling multiple concurrent requests
- **Circuit Breaker:** Stop making requests if error rate exceeds 50%

#### Performance Monitoring
```javascript
// Track API performance
const performanceMetrics = {
  requestCount: 0,
  successCount: 0,
  errorCount: 0,
  averageResponseTime: 0,
  lastApiCall: null
};

function updateMetrics(success, responseTime) {
  performanceMetrics.requestCount++;
  if (success) performanceMetrics.successCount++;
  else performanceMetrics.errorCount++;
  
  // Update rolling average
  performanceMetrics.averageResponseTime = 
    (performanceMetrics.averageResponseTime * 0.9) + (responseTime * 0.1);
    
  performanceMetrics.lastApiCall = new Date();
}
```

---

## Part F: Environment Configuration

### 6. Update Environment Variables
**File:** `textflow/server/.env`

**Add these required variables:**
```
# Hugging Face API Configuration
HUGGINGFACE_API_TOKEN=hf_your_token_here
HUGGINGFACE_BASE_URL=https://api-inference.huggingface.co
HUGGINGFACE_TIMEOUT=30000

# AI Service Configuration  
AI_SERVICE_ENABLED=true
AI_FALLBACK_ENABLED=true
AI_MAX_RETRIES=3
AI_CACHE_TTL=300
```

### 7. Environment Validation
**Update:** `textflow/server/src/config/env.js`

**Add validation for:**
- `HUGGINGFACE_API_TOKEN` - Required for AI functionality
- Validate token format (starts with 'hf_')
- Provide helpful error messages for missing/invalid tokens

---

## Part G: Integration with Entitlement Service

### 8. Entitlement Integration Pattern
**Implementation Requirements:**

#### Pre-Processing Validation
```javascript
// In route handlers, before calling AI service
const entitlementCheck = await checkUsageQuota(
  req.user.external_customer_id, 
  text.length
);

if (!entitlementCheck.allowed) {
  return res.status(402).json({
    success: false,
    blocked: true,
    reason: entitlementCheck.reason,
    message: entitlementCheck.message,
    usage: entitlementCheck.usage
  });
}

if (tone && tone !== 'default') {
  const featureCheck = await checkBooleanFeature(
    req.user.external_customer_id, 
    'tone_selector'
  );
  
  if (!featureCheck.hasAccess) {
    return res.status(402).json({
      success: false,
      blocked: true,
      reason: 'feature_locked',
      message: featureCheck.message
    });
  }
}
```

#### Input Length Validation by Plan
```javascript
// AI service input validation
function validateInput(text, userPlan) {
  const maxLength = userPlan === 'pro' ? 8000 : 1000;
  
  if (text.length > maxLength) {
    return {
      valid: false,
      error: 'text_too_long',
      message: `Text length (${text.length}) exceeds your plan limit of ${maxLength} characters. ${userPlan === 'free' ? 'Upgrade to Pro for longer text processing.' : ''}`
    };
  }
  
  return { valid: true };
}
```

---

## Part H: Testing and Validation

### 9. AI Service Testing
**File:** `textflow/server/scripts/test-ai-service.js`

**Test Requirements:**

#### Unit Tests for AI Functions
1. **Summarization Tests:**
   - Valid text input (success case)
   - Text too short (error case)  
   - Text too long (error case)
   - API timeout (fallback case)
   - Invalid API response (fallback case)

2. **Rewriting Tests:**
   - Default tone rewriting
   - Professional tone (if feature available)
   - Invalid tone handling
   - API failure scenarios

3. **Error Handling Tests:**
   - Network timeouts
   - API rate limiting
   - Invalid API keys
   - Malformed responses

#### Integration Tests
```javascript
// Test with real Hugging Face API
async function testSummarization() {
  const testText = "Long test article for summarization...";
  const result = await summarize(testText);
  
  assert(result.success === true);
  assert(result.summary.length < testText.length);
  assert(result.compressionRatio < 1.0);
}

async function testToneRewriting() {
  const testText = "This is a test sentence for rewriting.";
  const result = await rewrite(testText, 'professional');
  
  assert(result.success === true);
  assert(result.rewrittenText !== testText);
  assert(result.tone === 'professional');
}
```

### 10. Performance Testing
**Requirements:**

#### Load Testing
- Test concurrent requests (10 simultaneous users)
- Measure response times under load
- Verify rate limiting doesn't cause failures
- Test failover to fallback methods

#### Quality Testing  
- Compare AI output quality vs expectations
- Test edge cases (very short/long text)
- Validate tone differences are detectable
- Ensure fallbacks provide reasonable output

---

## Implementation Guidelines

### API Integration Best Practices
- **Always validate responses** - Don't trust external API response structure
- **Implement timeouts** - Never let requests hang indefinitely  
- **Use exponential backoff** - Be respectful of rate limits
- **Cache when appropriate** - Reduce API costs and improve performance
- **Log for debugging** - Track API performance and errors

### Error Handling Philosophy
- **Graceful degradation** - Provide fallbacks when possible
- **User-friendly errors** - Explain what went wrong and what user can do
- **Preserve user input** - Never lose user's text due to API failures
- **Fail fast for invalid inputs** - Don't waste API calls on bad data

### Performance Considerations
- **Preprocessing optimization** - Clean input before sending to API
- **Response streaming** - For future: stream results for long processing
- **Caching strategy** - Cache identical requests but respect user privacy
- **Monitoring integration** - Track performance for optimization

---

## Verification Checklist

**Before proceeding to Step 7, ensure:**
- [ ] Summarization function works with Hugging Face BART model
- [ ] Rewriting function works with T5 model and tone options
- [ ] Error handling covers all major failure scenarios
- [ ] Fallback methods provide reasonable output when APIs fail
- [ ] Performance is acceptable under normal load
- [ ] Integration with entitlement service works correctly
- [ ] Environment variables are properly configured
- [ ] Test suite validates all functionality
- [ ] Rate limiting and retry logic handle API constraints

---

## Common Pitfalls to Avoid

1. **API Key Security:** Never log or expose Hugging Face API tokens
2. **Rate Limiting:** Don't ignore 429 responses - implement proper backoff
3. **Input Validation:** Always validate text length before API calls
4. **Response Validation:** Don't assume Hugging Face returns expected format
5. **Error Messages:** Provide helpful errors without exposing internal details
6. **Fallback Quality:** Ensure fallback methods produce reasonable output
7. **Memory Usage:** Don't store large text inputs unnecessarily

---

## Testing Strategy

### Development Testing
- Test with various text lengths and types
- Verify all tone options work correctly
- Test error scenarios with invalid/missing API keys
- Validate fallback behavior under API failures

### Integration Testing
- Test full workflow: entitlement check → AI processing → usage tracking
- Verify plan-based feature restrictions work
- Test concurrent users and rate limiting
- Validate response times meet user expectations

### Quality Assurance
- Compare AI output quality across different inputs
- Ensure tone adjustments are perceptible and appropriate
- Test edge cases and boundary conditions
- Validate user experience during API outages

---

## Next Step Preview

**Step 7** will implement the text processing routes that combine this AI service with the entitlement service from Step 5. These routes will provide the main API endpoints that the React frontend will call, implementing the complete user workflow from authentication through text processing with usage tracking.

The AI service you build here is the core value proposition of TextFlow - it's what users are actually paying for when they upgrade to Pro for tone selection and higher usage limits.