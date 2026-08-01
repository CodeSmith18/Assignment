import express from 'express';
import session from 'express-session';
import axios from 'axios';
import { nanoid } from 'nanoid';
import { initDatabase } from '../src/db/init.js';
import { validateEnv, config } from '../src/config/env.js';
import authRoutes from '../src/routes/auth.js';
import textRoutes from '../src/routes/text.js';
import { requireAuth } from '../src/middleware/requireAuth.js';
import flexpriceClient from '../src/flexprice/client.js';
import { changeSubscriptionPlan } from '../src/flexprice/subscriptions.js';

// Run env validation
validateEnv();

async function runTests() {
  console.log('🧪 Starting Text Processing Routes Integration Tests...');

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
  
  // Mount routes
  app.use('/api/auth', authRoutes);
  app.use('/api/process', requireAuth, textRoutes);

  const PORT = 4005;
  const server = app.listen(PORT);
  const baseURL = `http://localhost:${PORT}`;
  console.log(`📡 Temporary test server listening on port ${PORT}`);

  const testEmail = `text_proc_test_${nanoid(8)}@example.com`;
  const testPassword = 'Password123!';
  const testName = 'Process Test User';
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
    // Setup: Sign Up to establish session and provision customer/subscription
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
      throw new Error(`Setup failed. Sign up returned status ${signupRes.status}: ${JSON.stringify(signupRes.data)}`);
    }

    // -------------------------------------------------------------------------
    // Test 1: Summarize 150 chars (Within Free Limit of 2,000)
    // -------------------------------------------------------------------------
    console.log('\nTest 1: Summarizing text (150 chars) on Free plan...');
    const text1 = 'The fast and massive developments in AI technology are considerably shaping the landscape of software engineering. Every good developer wants to build efficient apps.';
    const res1 = await makeRequest('post', '/api/process', {
      text: text1,
      operation: 'summarize'
    });

    console.log('Result Status:', res1.status);
    console.log('Result Body:', JSON.stringify(res1.data, null, 2));

    if (res1.status === 200 && res1.data.success === true) {
      console.log('✅ Correctly processed summarization.');
      if (!res1.data.eventId) throw new Error('Missing eventId in success response.');
    } else {
      throw new Error('Failed Test 1.');
    }

    // -------------------------------------------------------------------------
    // Test 2: Rewrite with Premium Tone (Professional) on Free Plan (Should be blocked)
    // -------------------------------------------------------------------------
    console.log('\nTest 2: Attempting tone selection (Professional) on Free plan...');
    const res2 = await makeRequest('post', '/api/process', {
      text: 'This is a casual sentence that needs professional touch.',
      operation: 'rewrite',
      tone: 'professional'
    });

    console.log('Result Status:', res2.status);
    console.log('Result Body:', JSON.stringify(res2.data, null, 2));

    if (res2.status === 402 && res2.data.blocked === true && res2.data.reason === 'feature_locked') {
      console.log('✅ Correctly blocked premium tone request on Free plan.');
    } else {
      throw new Error('Failed Test 2: Expected 402 feature_locked.');
    }

    // -------------------------------------------------------------------------
    // Test 3: Summarize 2,500 chars on Free Plan (Should be blocked)
    // -------------------------------------------------------------------------
    console.log('\nTest 3: Attempting summarization exceeding Free plan character quota (2,500 chars)...');
    const text3 = 'A '.repeat(2500);
    const res3 = await makeRequest('post', '/api/process', {
      text: text3,
      operation: 'summarize'
    });

    console.log('Result Status:', res3.status);
    console.log('Result Body:', JSON.stringify(res3.data, null, 2));

    if (res3.status === 402 && res3.data.blocked === true && res3.data.reason === 'quota_exceeded') {
      console.log('✅ Correctly blocked over-quota processing on Free plan.');
    } else {
      throw new Error('Failed Test 3: Expected 402 quota_exceeded.');
    }

    // -------------------------------------------------------------------------
    // Step 4: Upgrade subscription to Pro plan
    // -------------------------------------------------------------------------
    console.log('\n[Upgrade] Upgrading customer subscription to Pro plan in Flexprice...');
    const flexpriceCustomer = await flexpriceClient.get(`/customers/external/${createdUser.external_customer_id}`);
    const subscriptionsRes = await flexpriceClient.get(`/customers/external/${createdUser.external_customer_id}/subscriptions`);
    const activeSub = subscriptionsRes.items.find(s => s.subscription_status === 'active');
    
    await changeSubscriptionPlan(activeSub.id, config.proPlanId);
    console.log('✅ Subscription upgraded to Pro Plan.');

    // -------------------------------------------------------------------------
    // Test 5: Rewrite with Premium Tone (Professional) on Pro Plan (Should be allowed)
    // -------------------------------------------------------------------------
    console.log('\nTest 4: Attempting tone selection (Professional) on Pro plan...');
    const text4 = 'Software engineering is very good work, but sometimes it is extremely slow.';
    const res4 = await makeRequest('post', '/api/process', {
      text: text4,
      operation: 'rewrite',
      tone: 'professional'
    });

    console.log('Result Status:', res4.status);
    console.log('Result Body:', JSON.stringify(res4.data, null, 2));

    if (res4.status === 200 && res4.data.success === true && res4.data.result.tone === 'professional') {
      console.log('✅ Correctly allowed and executed premium tone rewrite on Pro plan.');
    } else {
      throw new Error('Failed Test 4: Expected 200 success.');
    }

    // -------------------------------------------------------------------------
    // Test 6: Summarize 3,000 chars on Pro Plan (Should be allowed - limit is 50,000+)
    // -------------------------------------------------------------------------
    console.log('\nTest 5: Summarizing long text (3,000 chars) on Pro plan...');
    const text5 = 'A '.repeat(3000);
    const res5 = await makeRequest('post', '/api/process', {
      text: text5,
      operation: 'summarize'
    });

    console.log('Result Status:', res5.status);
    console.log('Result Body:', JSON.stringify(res5.data, null, 2));

    if (res5.status === 200 && res5.data.success === true) {
      console.log('✅ Correctly allowed long text processing on Pro plan.');
    } else {
      throw new Error('Failed Test 5: Expected 200 success.');
    }

    // -------------------------------------------------------------------------
    // Cleanup: Remove test user records from Flexprice
    // -------------------------------------------------------------------------
    console.log('\n🧹 Cleaning up test customer data from Flexprice...');
    const subscriptions = await flexpriceClient.get(`/customers/external/${createdUser.external_customer_id}/subscriptions`).catch(() => ({ items: [] }));
    for (const sub of subscriptions.items || []) {
      await flexpriceClient.post(`/subscriptions/${sub.id}/cancel`, {
        cancellation_type: 'immediate'
      }).catch(() => {});
    }
    await flexpriceClient.delete(`/customers/${flexpriceCustomer.id}`).catch(() => {});
    console.log('✅ Cleanup completed.');

    console.log('\n🎉 ALL TEXT PROCESSING ROUTE INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');

  } catch (error) {
    console.error('\n❌ Text processing routes test suite failed!');
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
