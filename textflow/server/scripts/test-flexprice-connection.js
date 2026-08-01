import { createCustomer, getCustomerByExternalId, getCustomerEntitlements, getCustomerUsage } from '../src/flexprice/customers.js';
import { ingestEvent } from '../src/flexprice/events.js';
import { createSubscription, changeSubscriptionPlan, getCustomerSubscriptions } from '../src/flexprice/subscriptions.js';
import flexpriceClient from '../src/flexprice/client.js';
import { nanoid } from 'nanoid';

async function runTest() {
  console.log('🧪 Starting Flexprice Connection and Integration Test...');
  const testExternalId = `test_user_${nanoid(8)}`;
  let testCustomer = null;
  let testSubscription = null;

  try {
    // 1. Test basic connectivity
    console.log('\nStep 1: Testing basic connectivity to Flexprice API...');
    const healthCheck = await flexpriceClient.get('/customers');
    console.log('✅ Connected successfully! Customer list returned.');

    // 2. Create a test customer
    console.log(`\nStep 2: Creating test customer with external ID: ${testExternalId}...`);
    testCustomer = await createCustomer({
      external_id: testExternalId,
      name: 'Testy McTestFace',
      email: `${testExternalId}@example.com`
    });
    console.log('✅ Customer created successfully! ID:', testCustomer.id);

    // 3. Try to fetch customer by external ID
    console.log('\nStep 3: Fetching customer by external ID...');
    const fetchedCustomer = await getCustomerByExternalId(testExternalId);
    if (fetchedCustomer && fetchedCustomer.id === testCustomer.id) {
      console.log('✅ Customer retrieved correctly by external ID.');
    } else {
      throw new Error('❌ Customer retrieval mismatch!');
    }

    // 4. Test Event Ingestion
    console.log('\nStep 4: Testing single event ingestion...');
    const eventResponse = await ingestEvent({
      event_name: 'text_processed',
      external_customer_id: testExternalId,
      properties: {
        char_count: '150',
        operation_type: 'summarize',
        tone: 'default'
      }
    });
    console.log('✅ Event accepted successfully. Response:', eventResponse);

    // 5. Test Subscriptions & Entitlements (if plans exist)
    console.log('\nStep 5: Testing subscription creation (fetching plans first)...');
    const plansResponse = await flexpriceClient.get('/plans');
    
    if (plansResponse && plansResponse.items && plansResponse.items.length > 0) {
      // Find a plan to test subscription (e.g. Free or any plan)
      const freePlan = plansResponse.items.find(p => p.lookup_key === 'free_plan') || plansResponse.items[0];
      const proPlan = plansResponse.items.find(p => p.lookup_key === 'pro_plan') || (plansResponse.items[1] || plansResponse.items[0]);
      
      console.log(`Found plan: "${freePlan.name}" (ID: ${freePlan.id}). Creating subscription...`);
      testSubscription = await createSubscription({
        external_customer_id: testExternalId,
        plan_id: freePlan.id,
        currency: 'usd',
        billing_period: 'MONTHLY'
      });
      console.log('✅ Subscription created successfully! ID:', testSubscription.id);

      // Verify customer entitlements
      console.log('\nStep 6: Fetching customer entitlements...');
      const entitlements = await getCustomerEntitlements(testExternalId);
      console.log('✅ Entitlements retrieved successfully. Total features:', entitlements.features?.length || 0);

      // Verify customer usage summary
      console.log('\nStep 7: Fetching customer usage summary...');
      const usageSummary = await getCustomerUsage({ customer_lookup_key: testExternalId });
      console.log('✅ Usage summary retrieved successfully.');

      // Test Plan Change / Upgrade (only if different plans exist)
      if (freePlan.id !== proPlan.id) {
        console.log(`\nStep 8: Changing subscription plan to "${proPlan.name}" (ID: ${proPlan.id})...`);
        const changeResponse = await changeSubscriptionPlan(testSubscription.id, proPlan.id);
        console.log('✅ Subscription changed successfully!');
        
        // Re-check entitlements
        const postUpgradeEntitlements = await getCustomerEntitlements(testExternalId);
        console.log('✅ Entitlements after upgrade retrieved successfully.');
      } else {
        console.log('\nStep 8: Skipping subscription change test (only one plan exists).');
      }
    } else {
      console.log('ℹ️ No plans found in your Flexprice instance. Skipping subscription, entitlement, and usage tests.');
      console.log('ℹ️ These will be tested fully in Step 3 after running the seed script.');
    }

    console.log('\n🎉 ALL CONNECTION TESTS PASSED SUCCESSFULLY! 🎉');

  } catch (error) {
    console.error('\n❌ Test execution failed!');
    console.error('Error Details:', error.message || error);
    if (error.details) {
      console.error('API Response Details:', JSON.stringify(error.details, null, 2));
    }
    process.exit(1);
  }
}

runTest();
