# Output 04: Authentication & Subscription Management

This document lists the exact files implemented and modified for **Step 4: Authentication Routes & User Management**.

---

## 📁 Implemented and Modified Files

### 1. Database Queries Module
* **File Path**: [textflow/server/src/db/queries.js](file:///d:/Assingment/textflow/server/src/db/queries.js)
* **Description**: Direct SQLite CRUD operations mapping local users.
* **Details**:
  * `createUser(userData)`: Inserts email (lowercased/trimmed), bcrypt hash, unique external customer ID, Flexprice customer ID, and subscription ID. Returns user without password hash.
  * `getUserByEmail(email)`: Parameterized query to find a user by email (lowercased).
  * `getUserById(id)`: Fetches user details by primary key for session hydrations.
  * `updateUserFlexpriceIds(userId, customerId, subscriptionId)`: Links Flexprice identifiers back to the local database user profile.
  * `updateUserPlan(userId, plan)`: Updates the billing plan string ('free', 'pro').

### 2. Session Authentication Middleware
* **File Path**: [textflow/server/src/middleware/requireAuth.js](file:///d:/Assingment/textflow/server/src/middleware/requireAuth.js)
* **Description**: Gating filters for Express routes.
* **Details**:
  * `requireAuth`: Validates `req.session.userId`, queries database to verify user existence, attaches profile to `req.user`, and responds with `401 Unauthorized` if invalid.
  * `optionalAuth`: Lazily populates `req.user` if session is present, permitting anonymous operations to proceed with a `null` context.

### 3. Authentication Routes Module
* **File Path**: [textflow/server/src/routes/auth.js](file:///d:/Assingment/textflow/server/src/routes/auth.js)
* **Description**: Router mounting user login, signup, logout, and session checks.
* **Details**:
  * **Signup Flow (`POST /api/auth/signup`)**:
    * Enforces syntax validation (RFC-compliant email structures and passwords $\geq$ 8 characters).
    * Deduplicates email addresses.
    * Provisions a Flexprice customer record.
    * Provisions a Free plan monthly subscription.
    * Includes comprehensive rollback: cancels the subscription and deletes the customer if the local database write fails, preventing orphaned billing accounts.
    * Establishes the Express session.
  * **Login Flow (`POST /api/auth/login`)**:
    * Authenticates users against hashed passwords using `bcryptjs` validation.
    * Establishes session context.
  * **Logout Flow (`POST /api/auth/logout`)**:
    * Destroys the user session and flushes cookie storage.
  * **Me Query (`GET /api/auth/me`)**:
    * Protects session state checking. Returns active user JSON.

### 4. Express Entrypoint Mount (Updated)
* **File Path**: [textflow/server/src/server.js](file:///d:/Assingment/textflow/server/src/server.js)
* **Description**: Router mount configuration.
* **Details**:
  * Mounted the authentication router under `/api/auth`.

### 5. Authentication Integration Test Script
* **File Path**: [textflow/server/scripts/test-auth-flow.js](file:///d:/Assingment/textflow/server/scripts/test-auth-flow.js)
* **Description**: Automated test suite mapping local sessions and remote Flexprice webhooks.
* **Details**:
  * Programmatically provisions a mock Express listener on port `4005` to isolate database reads and writes.
  * Validates: validation errors, duplicate signups, successful provisioning, remote Flexprice checks, logout cookies, session invalidations, and re-authentication.
  * Employs clean state teardown: cancels testing subscriptions immediately and deletes the test customer.

---

## 📊 Integration Test Verification Report

Executing `node scripts/test-auth-flow.js` gives:

```text
✅ Environment configuration validated successfully
🧪 Starting Authentication Integration Tests...
📡 Temporary test server listening on port 4005

Test 1: Sign Up with missing fields...
✅ Correctly rejected signup with missing fields.

Test 2: Sign Up with weak password...
✅ Correctly rejected signup with weak password.

Test 3: Performing successful Sign Up...
✅ Database initialized successfully
[Signup Flow] Step A: Creating customer inside Flexprice: user_ktGCB91EpxKq
[Signup Flow] Step A Success: Customer ID: cust_01KYZ0HVNSY1F14E9ZWG33MBEA
[Signup Flow] Step B: Creating Free plan subscription for: user_ktGCB91EpxKq
[Signup Flow] Step B Success: Subscription ID: subs_01KYZ0HWE1S3PZ69A0AX585838
[Signup Flow] Step C Success: Local user record created: 2
✅ Sign Up successful! Created user: {"id":2,"email":"test_auth_f0ddxxnt@example.com","external_customer_id":"user_ktGCB91EpxKq","plan":"free","created_at":"2026-08-01 15:54:45"}

Test 4: Verifying Flexprice customer & subscription creation...
✅ Flexprice customer verified. ID: cust_01KYZ0HVNSY1F14E9ZWG33MBEA
✅ Flexprice subscription verified. ID: subs_01KYZ0HWE1S3PZ69A0AX585838, Plan ID: plan_01KYYZBBVH2JYTGBAXBS2WZPAV, Status: active

Test 5: Sign Up with duplicate email...
✅ Correctly rejected duplicate email signup.

Test 6: Checking /me session endpoint...
✅ /me returned current authenticated user details.

Test 7: Performing logout...
✅ Logout successful.

Test 8: Checking /me after logout...
✅ Correctly returned 401 Unauthorized after logging out.

Test 9: Login with wrong password...
✅ Correctly rejected login with invalid password.

Test 10: Login with correct credentials...
✅ Login successful! Session established.

🧹 Cleaning up test customer data from Flexprice...
✅ Cleanup completed.

🎉 ALL AUTHENTICATION FLOW TESTS PASSED SUCCESSFULLY! 🎉
📡 Test server shut down.
```
