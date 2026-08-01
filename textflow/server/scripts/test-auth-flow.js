import express from 'express';
import session from 'express-session';
import axios from 'axios';
import { nanoid } from 'nanoid';
import authRoutes from '../src/routes/auth.js';
import { initDatabase } from '../src/db/init.js';
import { validateEnv } from '../src/config/env.js';
import flexpriceClient from '../src/flexprice/client.js';

// Run env validation
validateEnv();

async function runTests() {
  console.log('🧪 Starting Authentication Integration Tests...');

  // Initialize DB
  initDatabase();

  // Create temporary Express app for testing
  const app = express();
  app.use(express.json());
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  }));
  
  app.use('/api/auth', authRoutes);

  // Protected route helper to test authentication middleware
  app.get('/api/protected', (req, res, next) => {
    // Mimic the route handler mounting auth middleware
    next();
  });

  const PORT = 4005;
  const server = app.listen(PORT);
  const baseURL = `http://localhost:${PORT}`;
  console.log(`📡 Temporary test server listening on port ${PORT}`);

  const testEmail = `test_auth_${nanoid(8)}@example.com`;
  const testPassword = 'Password123!';
  const testName = 'Auth Test User';
  let sessionCookie = '';
  let createdUser = null;

  try {
    const client = axios.create({
      baseURL,
      validateStatus: () => true // Allow handling non-200 status codes without throwing
    });

    // Request helper to pass cookies automatically
    async function makeRequest(method, url, data = {}) {
      const headers = {};
      if (sessionCookie) {
        headers['Cookie'] = sessionCookie;
      }
      
      const res = await client({
        method,
        url,
        data,
        headers
      });

      // Capture cookie
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        sessionCookie = setCookie[0].split(';')[0];
      }

      return res;
    }

    // -------------------------------------------------------------------------
    // Test 1: Sign Up with missing fields
    // -------------------------------------------------------------------------
    console.log('\nTest 1: Sign Up with missing fields...');
    const res1 = await makeRequest('post', '/api/auth/signup', { email: testEmail });
    if (res1.status === 400 && res1.data.success === false) {
      console.log('✅ Correctly rejected signup with missing fields.');
    } else {
      throw new Error(`Expected status 400, got ${res1.status}. Body: ${JSON.stringify(res1.data)}`);
    }

    // -------------------------------------------------------------------------
    // Test 2: Sign Up with weak password
    // -------------------------------------------------------------------------
    console.log('\nTest 2: Sign Up with weak password...');
    const res2 = await makeRequest('post', '/api/auth/signup', {
      email: testEmail,
      name: testName,
      password: '123'
    });
    if (res2.status === 400 && res2.data.success === false) {
      console.log('✅ Correctly rejected signup with weak password.');
    } else {
      throw new Error(`Expected status 400, got ${res2.status}. Body: ${JSON.stringify(res2.data)}`);
    }

    // -------------------------------------------------------------------------
    // Test 3: Successful Sign Up (checks Flexprice Customer & Free Plan Subscription)
    // -------------------------------------------------------------------------
    console.log('\nTest 3: Performing successful Sign Up...');
    const signupPayload = {
      email: testEmail,
      password: testPassword,
      name: testName
    };
    
    const res3 = await makeRequest('post', '/api/auth/signup', signupPayload);
    if (res3.status === 201 && res3.data.success === true) {
      createdUser = res3.data.user;
      console.log('✅ Sign Up successful! Created user:', JSON.stringify(createdUser));
      if (!createdUser.external_customer_id) {
        throw new Error('Missing external_customer_id in signup response.');
      }
    } else {
      throw new Error(`Expected status 201, got ${res3.status}. Body: ${JSON.stringify(res3.data)}`);
    }

    // -------------------------------------------------------------------------
    // Test 4: Verify Flexprice State
    // -------------------------------------------------------------------------
    console.log('\nTest 4: Verifying Flexprice customer & subscription creation...');
    const flexpriceCustomer = await flexpriceClient.get(`/customers/external/${createdUser.external_customer_id}`);
    if (flexpriceCustomer && flexpriceCustomer.email === testEmail.toLowerCase()) {
      console.log(`✅ Flexprice customer verified. ID: ${flexpriceCustomer.id}`);
    } else {
      throw new Error('Failed to find corresponding customer in Flexprice.');
    }

    const flexpriceSubs = await flexpriceClient.get(`/customers/external/${createdUser.external_customer_id}/subscriptions`);
    if (flexpriceSubs && flexpriceSubs.items && flexpriceSubs.items.length > 0) {
      const sub = flexpriceSubs.items[0];
      console.log(`✅ Flexprice subscription verified. ID: ${sub.id}, Plan ID: ${sub.plan_id}, Status: ${sub.subscription_status}`);
    } else {
      throw new Error('Failed to find corresponding Free subscription in Flexprice.');
    }

    // -------------------------------------------------------------------------
    // Test 5: Sign Up with duplicate email
    // -------------------------------------------------------------------------
    console.log('\nTest 5: Sign Up with duplicate email...');
    const res5 = await makeRequest('post', '/api/auth/signup', signupPayload);
    if (res5.status === 409 && res5.data.success === false) {
      console.log('✅ Correctly rejected duplicate email signup.');
    } else {
      throw new Error(`Expected status 409, got ${res5.status}. Body: ${JSON.stringify(res5.data)}`);
    }

    // -------------------------------------------------------------------------
    // Test 6: Verify current user session (/me)
    // -------------------------------------------------------------------------
    console.log('\nTest 6: Checking /me session endpoint...');
    const res6 = await makeRequest('get', '/api/auth/me');
    if (res6.status === 200 && res6.data.success === true && res6.data.user.email === testEmail.toLowerCase()) {
      console.log('✅ /me returned current authenticated user details.');
    } else {
      throw new Error(`Expected status 200, got ${res6.status}. Body: ${JSON.stringify(res6.data)}`);
    }

    // -------------------------------------------------------------------------
    // Test 7: Logout
    // -------------------------------------------------------------------------
    console.log('\nTest 7: Performing logout...');
    const res7 = await makeRequest('post', '/api/auth/logout');
    if (res7.status === 200 && res7.data.success === true) {
      console.log('✅ Logout successful.');
    } else {
      throw new Error(`Expected status 200, got ${res7.status}. Body: ${JSON.stringify(res7.data)}`);
    }

    // -------------------------------------------------------------------------
    // Test 8: Verify session cleared after logout (/me should return 401)
    // -------------------------------------------------------------------------
    console.log('\nTest 8: Checking /me after logout...');
    const res8 = await makeRequest('get', '/api/auth/me');
    if (res8.status === 401) {
      console.log('✅ Correctly returned 401 Unauthorized after logging out.');
    } else {
      throw new Error(`Expected status 401, got ${res8.status}. Body: ${JSON.stringify(res8.data)}`);
    }

    // -------------------------------------------------------------------------
    // Test 9: Login with wrong credentials
    // -------------------------------------------------------------------------
    console.log('\nTest 9: Login with wrong password...');
    const res9 = await makeRequest('post', '/api/auth/login', {
      email: testEmail,
      password: 'wrong_password'
    });
    if (res9.status === 401) {
      console.log('✅ Correctly rejected login with invalid password.');
    } else {
      throw new Error(`Expected status 401, got ${res9.status}. Body: ${JSON.stringify(res9.data)}`);
    }

    // -------------------------------------------------------------------------
    // Test 10: Login with correct credentials
    // -------------------------------------------------------------------------
    console.log('\nTest 10: Login with correct credentials...');
    const res10 = await makeRequest('post', '/api/auth/login', {
      email: testEmail,
      password: testPassword
    });
    if (res10.status === 200 && res10.data.success === true) {
      console.log('✅ Login successful! Session established.');
    } else {
      throw new Error(`Expected status 200, got ${res10.status}. Body: ${JSON.stringify(res10.data)}`);
    }

    // -------------------------------------------------------------------------
    // Clean up test customer from Flexprice
    // -------------------------------------------------------------------------
    console.log('\n🧹 Cleaning up test customer data from Flexprice...');
    const subscriptions = await flexpriceClient.get(`/customers/external/${createdUser.external_customer_id}/subscriptions`);
    for (const sub of subscriptions.items || []) {
      await flexpriceClient.post(`/subscriptions/${sub.id}/cancel`, {
        cancellation_type: 'immediate'
      }).catch(err => {
        console.error('Failed to cancel subscription:', err.message);
      });
    }
    await flexpriceClient.delete(`/customers/${flexpriceCustomer.id}`).catch(err => {
      console.error('Failed to delete customer:', err.message);
    });
    console.log('✅ Cleanup completed.');

    console.log('\n🎉 ALL AUTHENTICATION FLOW TESTS PASSED SUCCESSFULLY! 🎉');

  } catch (error) {
    console.error('\n❌ Authentication test suite failed!');
    console.error('Error Details:', error.message || error);
    process.exit(1);
  } finally {
    server.close();
    console.log('📡 Test server shut down.');
  }
}

runTests();
