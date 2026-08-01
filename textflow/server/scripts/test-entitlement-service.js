import { checkUsageQuota, checkBooleanFeature, getCurrentUsage } from '../src/services/entitlementService.js';
import { createCustomer } from '../src/flexprice/customers.js';
import { createSubscription, changeSubscriptionPlan } from '../src/flexprice/subscriptions.js';
import flexpriceClient from '../src/flexprice/client.js';
import { config } from '../src/config/env.js';
import { nanoid } from 'nanoid';

async function runTests() {
  console.log('🧪 Starting Entitlement Service Integration Tests...');
  const testExternalId = `ent_test_user_${nanoid(8)}`;
  let testCustomer = null;
  let testSubscription = null;

  try {
    // 0. Verify config
    if (!config.charFeatureId || !config.toneFeatureId || !config.freePlanId || !config.proPlanId) {
      throw new Error('Missing environment configuration. Run the seed script first!');
    }

    // 1. Create a clean test customer
    console.log(`\nStep 1: Creating test customer: ${testExternalId}...`);
    testCustomer = await createCustomer({
      external_id: testExternalId,
      name: 'Entitlement Test User',
      email: `${testExternalId}@example.com`
    });
    console.log('✅ Customer created. ID:', testCustomer.id);

    // 2. Create Free Plan subscription
    console.log(`\nStep 2: Subscribing customer to Free Plan: ${config.freePlanId}...`);
    testSubscription = await createSubscription({
      external_customer_id: testExternalId,
      plan_id: config.freePlanId,
      currency: 'usd',
      billing_period: 'MONTHLY'
    });
    console.log('✅ Subscribed to Free Plan. Subscription ID:', testSubscription.id);

    // 3. Test: Usage Quota - Within Limits
    console.log('\nStep 3: Checking usage quota (1,500 chars, limit is 2,000)...');
    const quotaCheck1 = await checkUsageQuota(testExternalId, 1500);
    console.log('Result:', JSON.stringify(quotaCheck1, null, 2));
    if (quotaCheck1.allowed === true && quotaCheck1.plan === 'free') {
      console.log('✅ Correctly allowed usage within limits.');
    } else {
      throw new Error('Failed quota check: expected allowed: true.');
    }

    // 4. Test: Usage Quota - Over Limits
    console.log('\nStep 4: Checking usage quota (2,500 chars, limit is 2,000)...');
    const quotaCheck2 = await checkUsageQuota(testExternalId, 2500);
    console.log('Result:', JSON.stringify(quotaCheck2, null, 2));
    if (quotaCheck2.allowed === false && quotaCheck2.reason === 'quota_exceeded' && quotaCheck2.upgradeRequired === true) {
      console.log('✅ Correctly blocked usage exceeding limits with upgrade required.');
    } else {
      throw new Error('Failed quota check: expected allowed: false.');
    }

    // 5. Test: Boolean Feature - Denied on Free
    console.log('\nStep 5: Checking Tone Selector feature access on Free plan...');
    const featureCheck1 = await checkBooleanFeature(testExternalId, 'tone_selector');
    console.log('Result:', JSON.stringify(featureCheck1, null, 2));
    if (featureCheck1.hasAccess === false && featureCheck1.enabled === false && featureCheck1.upgradeRequired === true) {
      console.log('✅ Correctly locked Tone Selector feature for Free user.');
    } else {
      throw new Error('Failed feature check: expected hasAccess: false.');
    }

    // 6. Test: Get Current Usage Dashboard Data on Free
    console.log('\nStep 6: Checking dashboard usage data retrieval (Free Plan)...');
    const usageDash1 = await getCurrentUsage(testExternalId);
    console.log('Result:', JSON.stringify(usageDash1, null, 2));
    if (usageDash1.success === true && usageDash1.plan.name === 'free' && usageDash1.features.toneSelector.enabled === false) {
      console.log('✅ Dashboard payload correctly structured for Free plan.');
    } else {
      throw new Error('Failed dashboard check.');
    }

    // 7. Upgrade to Pro Plan
    console.log(`\nStep 7: Upgrading subscription to Pro Plan: ${config.proPlanId}...`);
    const upgradeRes = await changeSubscriptionPlan(testSubscription.id, config.proPlanId);
    console.log('✅ Upgrade call completed successfully.');

    // 8. Test: Usage Quota - Allowed larger amount on Pro
    console.log('\nStep 8: Checking usage quota on Pro plan (40,000 chars, limit is 50,000)...');
    const quotaCheck3 = await checkUsageQuota(testExternalId, 40000);
    console.log('Result:', JSON.stringify(quotaCheck3, null, 2));
    if (quotaCheck3.allowed === true && quotaCheck3.plan === 'pro' && quotaCheck3.usage.limit >= 50000) {
      console.log('✅ Correctly allowed larger usage on Pro Plan.');
    } else {
      throw new Error('Failed Pro quota check.');
    }

    // 9. Test: Boolean Feature - Allowed on Pro
    console.log('\nStep 9: Checking Tone Selector feature access on Pro plan...');
    const featureCheck2 = await checkBooleanFeature(testExternalId, 'tone_selector');
    console.log('Result:', JSON.stringify(featureCheck2, null, 2));
    if (featureCheck2.hasAccess === true && featureCheck2.enabled === true) {
      console.log('✅ Correctly unlocked Tone Selector feature for Pro user.');
    } else {
      throw new Error('Failed Pro feature check.');
    }

    // 10. Test: Get Current Usage Dashboard Data on Pro
    console.log('\nStep 10: Checking dashboard usage data retrieval (Pro Plan)...');
    const usageDash2 = await getCurrentUsage(testExternalId);
    console.log('Result:', JSON.stringify(usageDash2, null, 2));
    if (usageDash2.success === true && usageDash2.plan.name === 'pro' && usageDash2.features.toneSelector.enabled === true) {
      console.log('✅ Dashboard payload correctly structured for Pro plan.');
    } else {
      throw new Error('Failed Pro dashboard check.');
    }

    // 11. Test: Edge case / Fail-open simulation
    console.log('\nStep 11: Simulating Flexprice failure / Fail-open handling...');
    // We pass a bad customer ID to checkUsageQuota which will throw a 404 (customer not found), 
    // triggering the fail-open fallback mechanism
    const failOpenQuota = await checkUsageQuota('non_existent_cust_id', 500);
    console.log('Result:', JSON.stringify(failOpenQuota, null, 2));
    if (failOpenQuota.allowed === true && failOpenQuota.failOpen === true && failOpenQuota.reason === 'entitlement_check_failed') {
      console.log('✅ Correctly failed open when Flexprice lookup failed.');
    } else {
      throw new Error('Failed to fail open during quota check failure.');
    }

    const failOpenFeature = await checkBooleanFeature('non_existent_cust_id', 'tone_selector');
    console.log('Result:', JSON.stringify(failOpenFeature, null, 2));
    if (failOpenFeature.hasAccess === true && failOpenFeature.failOpen === true && failOpenFeature.reason === 'entitlement_check_failed') {
      console.log('✅ Correctly failed open when Flexprice lookup failed for boolean feature.');
    } else {
      throw new Error('Failed to fail open during boolean check failure.');
    }

    console.log('\n🧹 Cleaning up test customer data from Flexprice...');
    const subscriptions = await flexpriceClient.get(`/customers/external/${testExternalId}/subscriptions`).catch(() => ({ items: [] }));
    for (const sub of subscriptions.items || []) {
      await flexpriceClient.post(`/subscriptions/${sub.id}/cancel`, {
        cancellation_type: 'immediate'
      }).catch(() => {});
    }
    await flexpriceClient.delete(`/customers/${testCustomer.id}`).catch(() => {});
    console.log('✅ Cleanup completed.');

    console.log('\n🎉 ALL ENTITLEMENT SERVICE TESTS PASSED SUCCESSFULLY! 🎉');

  } catch (error) {
    console.error('\n❌ Entitlement test suite failed!');
    console.error('Error Details:', error.message || error);
    
    // Attempt cleanup if customer was created
    if (testCustomer && testCustomer.id) {
      console.log('🧹 Attempting cleanup after failure...');
      const subscriptions = await flexpriceClient.get(`/customers/external/${testExternalId}/subscriptions`).catch(() => ({ items: [] }));
      for (const sub of subscriptions.items || []) {
        await flexpriceClient.post(`/subscriptions/${sub.id}/cancel`, {
          cancellation_type: 'immediate'
        }).catch(() => {});
      }
      await flexpriceClient.delete(`/customers/${testCustomer.id}`).catch(() => {});
    }
    process.exit(1);
  }
}

runTests();
