import express from 'express';
import session from 'express-session';
import axios from 'axios';
import { nanoid } from 'nanoid';
import { initDatabase } from '../src/db/init.js';
import { validateEnv, config } from '../src/config/env.js';
import authRoutes from '../src/routes/auth.js';
import textRoutes from '../src/routes/text.js';
import usageRoutes from '../src/routes/usage.js';
import billingRoutes from '../src/routes/billing.js';
import { requireAuth } from '../src/middleware/requireAuth.js';
import flexpriceClient from '../src/flexprice/client.js';

// Validate environment
validateEnv();

async function runTests() {
  console.log('🧪 Starting Usage & Billing Routes Integration Tests...');

  // Initialize DB
  initDatabase();

  // Create temporary Express app
  const app = express();
  app.use(express.json());
  app.use(session({
    secret: 'test-billing-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  }));

  // Mount routes
  app.use('/api/auth', authRoutes);
  app.use('/api/process', requireAuth, textRoutes);
  app.use('/api/usage', requireAuth, usageRoutes);
  app.use('/api/billing', requireAuth, billingRoutes);

  const PORT = 4006;
  const server = app.listen(PORT);
  const baseURL = `http://localhost:${PORT}`;
  console.log(`📡 Temporary billing test server listening on port ${PORT}`);

  const testEmail = `billing_test_${nanoid(8)}@example.com`;
  const testPassword = 'Password123!';
  const testName = 'Billing Test User';
  let sessionCookie = '';
  let createdUser = null;

  try {
    const client = axios.create({
      baseURL,
      validateStatus: () => true
    });

    async function makeRequest(method, url, data = {}) {
      const headers = {};
      if (sessionCookie) {
        headers['Cookie'] = sessionCookie;
      }
      const res = await client({ method, url, data, headers });
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        sessionCookie = setCookie[0].split(';')[0];
      }
      return res;
    }

    // -------------------------------------------------------------------------
    // Setup: Sign Up
    // -------------------------------------------------------------------------
    console.log('\n[Setup] Registering test user...');
    const signupRes = await makeRequest('post', '/api/auth/signup', {
      email: testEmail,
      password: testPassword,
      name: testName
    });

    if (signupRes.status === 201 && signupRes.data.success === true) {
      createdUser = signupRes.data.user;
      console.log(`✅ User registered. External Customer ID: ${createdUser.external_customer_id}`);
    } else {
      throw new Error(`Setup failed: Sign up returned ${signupRes.status}`);
    }

    // -------------------------------------------------------------------------
    // Test 1: Fetch Dashboard (Free Plan Initial State)
    // -------------------------------------------------------------------------
    console.log('\nTest 1: Fetching usage dashboard data on Free plan...');
    const res1 = await makeRequest('get', '/api/usage');
    console.log('Result Status:', res1.status);
    console.log('Result Body:', JSON.stringify(res1.data, null, 2));

    if (res1.status === 200 && res1.data.success === true) {
      const { plan, usage, features, history } = res1.data;
      if (plan.name !== 'free') throw new Error(`Expected plan name "free", got "${plan.name}"`);
      if (usage.charactersProcessed.limit !== 2000) throw new Error(`Expected Free limit 2000, got ${usage.charactersProcessed.limit}`);
      if (features.toneSelector.enabled !== false) throw new Error('Expected toneSelector feature to be disabled.');
      if (!Array.isArray(history)) throw new Error('Expected history to be an array.');
      console.log('✅ Correctly verified initial Free plan usage metrics.');
    } else {
      throw new Error('Failed Test 1.');
    }

    // -------------------------------------------------------------------------
    // Test 2: Upgrade to Pro Plan
    // -------------------------------------------------------------------------
    console.log('\nTest 2: Requesting plan upgrade to Pro Plan...');
    const res2 = await makeRequest('post', '/api/billing/upgrade');
    console.log('Result Status:', res2.status);
    console.log('Result Body:', JSON.stringify(res2.data, null, 2));

    if (res2.status === 200 && res2.data.success === true) {
      if (res2.data.subscription.planId !== config.proPlanId) throw new Error('Mismatched planId in upgrade subscription payload');
      console.log('✅ Correctly initiated subscription upgrade.');
    } else {
      throw new Error('Failed Test 2.');
    }

    // -------------------------------------------------------------------------
    // Test 3: Fetch Dashboard (Pro Plan State)
    // -------------------------------------------------------------------------
    console.log('\nTest 3: Fetching usage dashboard data after Pro upgrade...');
    const res3 = await makeRequest('get', '/api/usage');
    console.log('Result Status:', res3.status);
    console.log('Result Body:', JSON.stringify(res3.data, null, 2));

    if (res3.status === 200 && res3.data.success === true) {
      const { plan, usage, features } = res3.data;
      if (plan.name !== 'pro') throw new Error(`Expected plan name "pro", got "${plan.name}"`);
      if (usage.charactersProcessed.limit < 50000) throw new Error(`Expected Pro limit >= 50000, got ${usage.charactersProcessed.limit}`);
      if (features.toneSelector.enabled !== true) throw new Error('Expected toneSelector feature to be enabled.');
      console.log('✅ Correctly verified upgraded Pro plan usage metrics.');
    } else {
      throw new Error('Failed Test 3.');
    }

    // -------------------------------------------------------------------------
    // Test 4: Downgrade back to Free Plan
    // -------------------------------------------------------------------------
    console.log('\nTest 4: Requesting plan downgrade to Free Plan...');
    const res4 = await makeRequest('post', '/api/billing/downgrade');
    console.log('Result Status:', res4.status);
    console.log('Result Body:', JSON.stringify(res4.data, null, 2));

    if (res4.status === 200 && res4.data.success === true) {
      if (res4.data.subscription.planId !== config.freePlanId) throw new Error('Mismatched planId in downgrade subscription payload');
      console.log('✅ Correctly initiated subscription downgrade.');
    } else {
      throw new Error('Failed Test 4.');
    }

    // -------------------------------------------------------------------------
    // Test 5: Fetch Dashboard (Free Plan Downgraded State)
    // -------------------------------------------------------------------------
    console.log('\nTest 5: Fetching usage dashboard data after Free downgrade...');
    const res5 = await makeRequest('get', '/api/usage');
    console.log('Result Status:', res5.status);
    console.log('Result Body:', JSON.stringify(res5.data, null, 2));

    if (res5.status === 200 && res5.data.success === true) {
      const { plan, usage, features } = res5.data;
      if (plan.name !== 'free') throw new Error(`Expected plan name "free", got "${plan.name}"`);
      if (usage.charactersProcessed.limit < 2000) throw new Error(`Expected Free limit >= 2000, got ${usage.charactersProcessed.limit}`);
      if (features.toneSelector.enabled !== false) throw new Error('Expected toneSelector feature to be disabled.');
      console.log('✅ Correctly verified downgraded Free plan usage metrics.');
    } else {
      throw new Error('Failed Test 5.');
    }

    // -------------------------------------------------------------------------
    // Cleanup: Remove test customer records
    // -------------------------------------------------------------------------
    console.log('\n🧹 Cleaning up test customer data from Flexprice...');
    const flexpriceCustomer = await flexpriceClient.get(`/customers/external/${createdUser.external_customer_id}`);
    const subscriptions = await flexpriceClient.get(`/customers/external/${createdUser.external_customer_id}/subscriptions`).catch(() => ({ items: [] }));
    for (const sub of subscriptions.items || []) {
      await flexpriceClient.post(`/subscriptions/${sub.id}/cancel`, {
        cancellation_type: 'immediate'
      }).catch(() => {});
    }
    await flexpriceClient.delete(`/customers/${flexpriceCustomer.id}`).catch(() => {});
    console.log('✅ Cleanup completed.');

    console.log('\n🎉 ALL USAGE & BILLING ROUTE INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');

  } catch (error) {
    console.error('\n❌ Usage & Billing routes test suite failed!');
    console.error('Error Details:', error.message || error);
    
    // Attempt cleanup
    if (createdUser && createdUser.external_customer_id) {
      console.log('🧹 Attempting cleanup after failure...');
      try {
        const flexpriceCustomer = await flexpriceClient.get(`/customers/external/${createdUser.external_customer_id}`).catch(() => null);
        if (flexpriceCustomer) {
          const subscriptions = await flexpriceClient.get(`/customers/external/${createdUser.external_customer_id}/subscriptions`).catch(() => ({ items: [] }));
          for (const sub of subscriptions.items || []) {
            await flexpriceClient.post(`/subscriptions/${sub.id}/cancel`, { cancellation_type: 'immediate' }).catch(() => {});
          }
          await flexpriceClient.delete(`/customers/${flexpriceCustomer.id}`).catch(() => {});
        }
      } catch (err) {
        console.error('Cleanup failed:', err.message);
      }
    }
    process.exit(1);
  } finally {
    server.close();
    console.log('📡 Test server shut down.');
  }
}

runTests();
