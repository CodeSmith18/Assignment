# Step 4: Authentication Routes & User Management
## Implementation Instructions for TextFlow SaaS

### Overview
This step implements the backend authentication system that connects local users to Flexprice customers and subscriptions. When users sign up, they'll automatically get a Flexprice customer record and Free plan subscription. The system provides session-based authentication with proper security for the React frontend.

---

## Part A: Authentication Route Foundation

### 1. Create Authentication Routes Module
**File:** `textflow/server/src/routes/auth.js`

**Core Requirements:**
- Implement four main endpoints: signup, login, logout, and current user status
- Use the Flexprice client modules from Step 2 for customer/subscription creation
- Integrate with express-session for secure session management
- Return consistent JSON responses with proper error handling
- Support CORS for React frontend communication

**Route Specifications:**

#### POST /api/auth/signup
**Purpose:** Register new user with automatic Flexprice integration

**Request Body:**
```javascript
{
  "email": "user@example.com",
  "password": "plaintext_password",
  "name": "User Name"
}
```

**Implementation Requirements:**
- Validate email format and password strength
- Check for existing users with same email
- Hash password using bcrypt with proper salt rounds (12+ recommended)
- Generate unique `external_customer_id` using nanoid
- Create local user record in SQLite database
- Create Flexprice customer using `createCustomer()` function
- Create Free plan subscription using `createSubscription()` with `FREE_PLAN_ID`
- Cache Flexprice customer ID and subscription ID in local user record
- Set up authenticated session
- Return user object without password hash

**Response Format:**
```javascript
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "external_customer_id": "user_abc123",
    "plan": "free",
    "created_at": "2026-08-01T..."
  }
}
```

#### POST /api/auth/login
**Purpose:** Authenticate existing user

**Request Body:**
```javascript
{
  "email": "user@example.com", 
  "password": "plaintext_password"
}
```

**Implementation Requirements:**
- Look up user by email address
- Compare provided password against stored hash using bcrypt
- Set up authenticated session on successful login
- Update session with current user information
- Return user object without sensitive data

#### POST /api/auth/logout
**Purpose:** End user session

**Implementation Requirements:**
- Destroy express session
- Clear session cookie
- Return success confirmation

#### GET /api/auth/me
**Purpose:** Get current user information for authenticated sessions

**Implementation Requirements:**
- Check if user is authenticated via session
- Return current user object if authenticated
- Return 401 unauthorized if no valid session

---

## Part B: Database Integration

### 2. User Database Operations
**File:** `textflow/server/src/db/queries.js`

**Implement these database functions:**

#### `createUser(userData)`
**Requirements:**
- Insert new user record with all required fields
- Return the created user object with generated ID
- Handle database constraints (unique email)
- Use prepared statements for security

#### `getUserByEmail(email)`
**Requirements:**
- Find user by email address
- Return user object with all fields including password hash
- Return null if user not found
- Use parameterized queries

#### `getUserById(id)`
**Requirements:**
- Find user by internal ID
- Return user object without password hash (for session use)
- Return null if user not found

#### `updateUserFlexpriceIds(userId, customerId, subscriptionId)`
**Requirements:**
- Update existing user record with Flexprice entity IDs
- Used after successful Flexprice customer/subscription creation
- Handle cases where user might already have these IDs

### 3. Database Error Handling
**Implementation Requirements:**
- Handle SQLite constraint violations gracefully
- Map database errors to meaningful application errors
- Provide helpful error messages for duplicate emails
- Ensure database connections are properly managed

---

## Part C: Authentication Middleware

### 4. Protected Route Middleware
**File:** `textflow/server/src/middleware/requireAuth.js`

**Implementation Requirements:**

#### `requireAuth` Middleware Function
- Check for valid session and user ID in session data
- Load current user from database if session exists
- Attach user object to `req.user` for use in route handlers
- Return 401 JSON response if not authenticated
- Support optional user loading (don't fail if user not found, just continue without auth)

#### `optionalAuth` Middleware Function
- Similar to requireAuth but doesn't fail if no authentication
- Sets `req.user` to null if not authenticated
- Useful for endpoints that work with or without authentication

**Middleware Usage Pattern:**
```javascript
// Protected route
app.use('/api/process', requireAuth, textProcessingRoutes);

// Optional auth route  
app.get('/api/public-data', optionalAuth, (req, res) => {
  // req.user will be set if authenticated, null otherwise
});
```

---

## Part D: Session Configuration

### 5. Express Session Setup
**Update:** `textflow/server/src/server.js`

**Session Configuration Requirements:**
- Configure express-session with secure settings
- Set appropriate session cookie options for development and production
- Use environment variables for session secret
- Configure session storage (default memory store is fine for development)
- Set proper cookie domain and sameSite for CORS

**Security Requirements:**
- Session secret should be cryptographically strong
- Cookie should be httpOnly to prevent XSS
- Secure flag should be set appropriately based on environment
- sameSite should be configured for CORS with React frontend

**Session Cookie Configuration:**
```javascript
{
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent XSS
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // Allow cross-origin requests from React app
  }
}
```

---

## Part E: Flexprice Integration

### 6. Signup Flow Flexprice Integration
**Implementation Requirements:**

#### Customer Creation Process
- Use `createCustomer()` from Step 2 client modules
- Pass user's email, name, and generated external_customer_id
- Handle Flexprice API failures gracefully
- If customer creation fails, don't create local user (rollback)

#### Subscription Creation Process  
- Use `createSubscription()` with the user's external_customer_id
- Subscribe to Free plan using `FREE_PLAN_ID` from environment
- Set currency to 'usd' and billing period to 'MONTHLY'
- Store subscription ID in local user record for future plan changes

#### Error Handling Strategy
- If local user creation succeeds but Flexprice operations fail, clean up local user
- Provide meaningful error messages for different failure scenarios
- Log Flexprice API errors for debugging while returning user-friendly messages
- Consider implementing retry logic for transient failures

### 7. External Customer ID Generation
**Implementation Requirements:**
- Use nanoid to generate unique, URL-safe customer IDs
- Prefix with 'user_' for easy identification: `user_${nanoid(12)}`
- Ensure uniqueness by checking against existing users before use
- Store in local database for mapping between local users and Flexprice customers

---

## Part F: Input Validation & Security

### 8. Request Validation
**Implementation Requirements:**

#### Email Validation
- Use proper email regex or validation library
- Check for reasonable email length limits
- Normalize email addresses (lowercase, trim whitespace)

#### Password Security
- Enforce minimum password length (8+ characters recommended)
- Check for common password patterns to reject
- Use bcrypt with salt rounds 12 or higher for hashing
- Never log or store plaintext passwords

#### Input Sanitization
- Trim whitespace from all text inputs
- Validate maximum lengths for all fields
- Escape or reject potentially dangerous characters
- Use prepared statements/parameterized queries for all database operations

### 9. Rate Limiting (Optional but Recommended)
**Implementation Requirements:**
- Implement rate limiting on authentication endpoints
- Limit signup attempts per IP address
- Limit login attempts per email address
- Use simple in-memory store or Redis for rate limit tracking

---

## Part G: Error Handling & Response Formatting

### 10. Authentication Error Responses
**Implementation Requirements:**

#### Consistent Error Response Format
```javascript
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "User-friendly error message",
    "details": {} // Optional additional context
  }
}
```

#### Specific Error Scenarios
- **Duplicate Email:** Return 409 Conflict with helpful message
- **Invalid Credentials:** Return 401 Unauthorized (don't specify if email or password was wrong)
- **Weak Password:** Return 400 Bad Request with password requirements
- **Flexprice API Failure:** Return 503 Service Unavailable with retry message
- **Database Errors:** Return 500 Internal Server Error with generic message

### 11. Success Response Formatting
**Implementation Requirements:**
- Always return success: true for successful operations
- Include relevant user data without sensitive information
- Provide consistent field names across all endpoints
- Include timestamps in ISO format

---

## Part H: Integration Testing

### 12. Authentication Integration Tests
**File:** `textflow/server/scripts/test-auth-flow.js`

**Implement comprehensive test that:**
- Tests complete signup flow with Flexprice integration
- Verifies user can log in with created credentials
- Confirms session persistence across requests
- Tests logout functionality
- Verifies protected route access control
- Checks Flexprice customer and subscription creation
- Tests error scenarios (duplicate email, wrong password, etc.)

**Test Requirements:**
- Use unique test data for each run (timestamps, random IDs)
- Clean up test data after completion
- Test both success and failure scenarios
- Verify Flexprice integration is working correctly
- Ensure sessions work properly with the React frontend CORS setup

---

## Implementation Guidelines

### Security Best Practices
- Never trust user input - validate and sanitize everything
- Use HTTPS in production for session security
- Implement proper CORS configuration for React frontend
- Hash passwords with sufficient salt rounds
- Use cryptographically secure session secrets
- Log authentication attempts for security monitoring

### Database Best Practices
- Use transactions for multi-step operations (user creation + Flexprice integration)
- Implement proper database connection pooling
- Use prepared statements for all queries
- Handle database connection failures gracefully
- Consider database migration strategy for future schema changes

### Flexprice Integration Patterns
- Always handle Flexprice API failures gracefully
- Implement idempotency where possible
- Use the exact entity IDs from Step 3's environment variables
- Keep local user data in sync with Flexprice customer data
- Plan for Flexprice rate limiting in high-traffic scenarios

---

## Verification Checklist

**Before proceeding to Step 5, ensure:**
- [ ] All four authentication endpoints are implemented and tested
- [ ] Signup creates both local user and Flexprice customer/subscription
- [ ] Login/logout works with proper session management
- [ ] Protected route middleware functions correctly
- [ ] CORS configuration allows React frontend to authenticate
- [ ] Error handling provides clear, secure error messages
- [ ] Database operations are secure and efficient
- [ ] Integration test passes for complete authentication flow
- [ ] Users are automatically subscribed to Free plan on signup

---

## Common Pitfalls to Avoid

1. **Password Security:** Don't use weak hashing algorithms or insufficient salt rounds
2. **Session Security:** Don't forget CORS and cookie security configuration
3. **Error Messages:** Don't reveal whether email exists during login failures
4. **Database Transactions:** Don't leave partial user records if Flexprice operations fail
5. **Environment Dependencies:** Don't hardcode plan IDs - use the seeded environment variables
6. **Session State:** Don't trust session data without validating user still exists in database

---

## Testing Strategy

### Manual Testing Sequence
1. Test signup with new email - should create user and Flexprice customer
2. Test signup with duplicate email - should return appropriate error
3. Test login with correct credentials - should establish session
4. Test login with wrong credentials - should return 401
5. Test protected route access without login - should return 401
6. Test protected route access with login - should work
7. Test logout - should clear session
8. Verify React frontend can authenticate through CORS

### Automated Testing
- Run authentication integration test script
- Verify all test scenarios pass
- Confirm cleanup of test data
- Check Flexprice integration is working

---

## Next Step Preview

**Step 5** will implement the entitlement service that uses these authenticated users to check their plan limits and feature access. It will integrate with the Flexprice entitlement checking to enforce usage limits and gate premium features, building on the user sessions created in this step.

The authentication system you build here is the foundation that enables per-user entitlement checking and usage tracking in the upcoming text processing features.