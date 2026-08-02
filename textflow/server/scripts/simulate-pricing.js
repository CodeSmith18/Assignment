import flexpriceClient from '../src/flexprice/client.js';
import { bulkIngestEvents } from '../src/flexprice/events.js';
import { createCustomer } from '../src/flexprice/customers.js';
import { createSubscription } from '../src/flexprice/subscriptions.js';
import { getDatabase, runQuery, allQuery } from '../src/db/init.js';
import { config } from '../src/config/env.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Price calculator for Model A (Package pricing: $9 flat + $0.50 per 1k characters)
function calculateModelAPrice(chars) {
  const packages = Math.ceil(chars / 1000);
  return 9.00 + (packages * 0.50);
}

// Price calculator for Model B (Tiered Slab pricing: $9 flat + tiers)
function calculateModelBPrice(chars) {
  let usageCost = 0;
  if (chars <= 10000) {
    usageCost += chars * 0.0008;
  } else if (chars <= 30000) {
    usageCost += (10000 * 0.0008) + ((chars - 10000) * 0.0005);
  } else {
    usageCost += (10000 * 0.0008) + (20000 * 0.0005) + ((chars - 30000) * 0.0003);
  }
  return 9.00 + usageCost;
}

// Simulated profiles
const PROFILES = [
  { externalId: 'sim_light_1', type: 'light', minEvents: 12, maxEvents: 18, minChars: 200, maxChars: 400 },
  { externalId: 'sim_medium_1', type: 'medium', minEvents: 50, maxEvents: 70, minChars: 300, maxChars: 800 },
  { externalId: 'sim_heavy_1', type: 'heavy', minEvents: 180, maxEvents: 220, minChars: 400, maxChars: 1200 },
  { externalId: 'sim_heavy_2', type: 'heavy', minEvents: 190, maxEvents: 210, minChars: 450, maxChars: 1100 },
  { externalId: 'sim_medium_2', type: 'medium', minEvents: 55, maxEvents: 65, minChars: 350, maxChars: 750 }
];

async function runSimulation() {
  console.log('📊 Starting Pricing Experiment & Billing Simulation...');
  const db = getDatabase();

  try {
    // 1. Setup Alternative Tiered Plan (pro_plan_tiered) on Flexprice if not present
    console.log('\n[Step 1] Ensuring Alternative Tiered Plan (Model B) exists on Flexprice...');
    const plansRes = await flexpriceClient.get('/plans');
    let tieredPlan = plansRes.items?.find(p => p.lookup_key === 'pro_plan_tiered');
    
    if (tieredPlan) {
      console.log(`✅ Tiered Pro plan already exists. ID: ${tieredPlan.id}`);
    } else {
      console.log('   - Creating plan: "Pro Tiered" (Model B)...');
      tieredPlan = await flexpriceClient.post('/plans', {
        name: 'Pro Tiered',
        lookup_key: 'pro_plan_tiered',
        description: 'Pro plan cloned with slab tiered pricing Model B'
      });
      console.log(`✅ Created tiered plan. ID: ${tieredPlan.id}`);

      // Attach entitlements to tiered plan
      console.log('   - Attaching entitlements to Pro Tiered...');
      await flexpriceClient.post('/entitlements', {
        plan_id: tieredPlan.id,
        feature_id: config.charFeatureId,
        feature_type: 'metered',
        usage_limit: 150000, // higher limit for tiered
        usage_reset_period: 'MONTHLY',
        is_soft_limit: false,
        is_enabled: true
      });
      await flexpriceClient.post('/entitlements', {
        plan_id: tieredPlan.id,
        feature_id: config.toneFeatureId,
        feature_type: 'boolean',
        is_enabled: true
      });
      console.log('✅ Entitlements configured.');

      // Attach prices to tiered plan
      console.log('   - Creating slab tiered price for Pro Tiered...');
      await flexpriceClient.post('/prices', {
        type: 'FIXED',
        billing_model: 'FLAT_FEE',
        entity_type: 'PLAN',
        entity_id: tieredPlan.id,
        currency: 'usd',
        amount: '9.00',
        billing_period: 'MONTHLY',
        billing_period_count: 1,
        price_unit_type: 'FIAT',
        invoice_cadence: 'ADVANCE'
      });
      await flexpriceClient.post('/prices', {
        type: 'USAGE',
        billing_model: 'TIERED',
        entity_type: 'PLAN',
        entity_id: tieredPlan.id,
        meter_id: config.charMeterId,
        currency: 'usd',
        billing_period: 'MONTHLY',
        billing_period_count: 1,
        price_unit_type: 'FIAT',
        invoice_cadence: 'ARREAR',
        tier_mode: 'SLAB',
        tiers: [
          { up_to: 10000, unit_amount: '0.0008' },
          { up_to: 30000, unit_amount: '0.0005' },
          { up_to: null,  unit_amount: '0.0003' }
        ]
      });
      console.log('✅ Pricing Model B successfully seeded in Flexprice.');
    }

    // 2. Setup Simulated Customers and Subscriptions
    console.log('\n[Step 2] Provisioning simulated customers and subscriptions...');
    
    // Clear simulated customers local database if any
    await runQuery(db, `DELETE FROM simulated_customers`);

    const customersMap = {};

    for (const profile of PROFILES) {
      console.log(`   - Setting up customer "${profile.externalId}" (${profile.type} profile)...`);
      
      // Cleanup existing test data if any
      const existingFlexCust = await flexpriceClient.get(`/customers/external/${profile.externalId}`).catch(() => null);
      if (existingFlexCust) {
        const subs = await flexpriceClient.get(`/customers/external/${profile.externalId}/subscriptions`).catch(() => ({ items: [] }));
        for (const sub of subs.items || []) {
          await flexpriceClient.post(`/subscriptions/${sub.id}/cancel`, { cancellation_type: 'immediate' }).catch(() => {});
        }
        await flexpriceClient.delete(`/customers/${existingFlexCust.id}`).catch(() => {});
      }

      // Create Customer
      const flexpriceCustomer = await createCustomer({
        external_id: profile.externalId,
        name: `Simulated User ${profile.externalId.toUpperCase()}`,
        email: `${profile.externalId}@simulation.com`
      });

      // Subscribe to Pro Plan Model A
      const flexpriceSubscription = await createSubscription({
        external_customer_id: profile.externalId,
        plan_id: config.proPlanId,
        currency: 'usd',
        billing_period: 'MONTHLY'
      });

      // Store in local DB
      await runQuery(db, `
        INSERT INTO simulated_customers (external_customer_id, profile, flexprice_customer_id, flexprice_subscription_id)
        VALUES (?, ?, ?, ?)
      `, [profile.externalId, profile.type, flexpriceCustomer.id, flexpriceSubscription.id]);

      customersMap[profile.externalId] = {
        flexpriceCustomerId: flexpriceCustomer.id,
        flexpriceSubscriptionId: flexpriceSubscription.id
      };
    }
    console.log('✅ Customers and subscriptions provisioned.');

    // 3. Generate and Ingest Usage Events Burst
    console.log('\n[Step 3] Generating usage event bursts spread across the last 30 days...');
    
    const eventsToIngest = [];
    const now = new Date();
    const generatedCharsMap = {};

    for (const profile of PROFILES) {
      const numEvents = Math.floor(Math.random() * (profile.maxEvents - profile.minEvents + 1)) + profile.minEvents;
      let totalGeneratedChars = 0;

      for (let i = 0; i < numEvents; i++) {
        const chars = Math.floor(Math.random() * (profile.maxChars - profile.minChars + 1)) + profile.minChars;
        totalGeneratedChars += chars;

        // Generate random timestamp within the last 30 days
        const daysAgo = Math.random() * 30;
        const timestamp = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000)).toISOString();

        eventsToIngest.push({
          event_name: 'text_processed',
          external_customer_id: profile.externalId,
          properties: {
            char_count: chars,
            operation_type: Math.random() > 0.5 ? 'summarize' : 'rewrite',
            tone: 'default'
          },
          timestamp
        });
      }

      generatedCharsMap[profile.externalId] = totalGeneratedChars;
      console.log(`   - Generated ${numEvents} events for ${profile.externalId} (${totalGeneratedChars.toLocaleString()} total chars).`);
    }

    // Ingest events in chunks of 50
    console.log(`\n   - Ingesting ${eventsToIngest.length} total events to Flexprice...`);
    const chunkSize = 50;
    for (let i = 0; i < eventsToIngest.length; i += chunkSize) {
      const chunk = eventsToIngest.slice(i, i + chunkSize);
      await bulkIngestEvents(chunk);
      process.stdout.write('.');
    }
    console.log('\n✅ Bulk event ingestion complete.');

    // 4. Wait briefly for aggregation pipeline
    console.log('\n[Step 4] Waiting 5 seconds for Flexprice Kafka/Clickhouse pipeline to aggregate metrics...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 5. Query Flexprice for Aggregated Usage and Calculate Costs
    console.log('\n[Step 5] Compiling results & calculating model comparison...');
    
    const results = [];

    for (const profile of PROFILES) {
      // Query Flexprice usage summary
      const usageRes = await flexpriceClient.get('/customers/usage', {
        params: {
          customer_id: customersMap[profile.externalId].flexpriceCustomerId,
          feature_ids: config.charFeatureId
        }
      });

      // Get current usage total characters
      const usageSumObj = usageRes.items?.find(item => item.feature_id === config.charFeatureId);
      let totalChars = usageSumObj ? parseInt(usageSumObj.amount || 0) : 0;
      
      // Fallback to local counts if Flexprice has not completed Kafka/Clickhouse aggregation yet
      let isFallback = false;
      if (totalChars === 0) {
        totalChars = generatedCharsMap[profile.externalId];
        isFallback = true;
      }

      // Pricing math comparison
      const costModelA = calculateModelAPrice(totalChars);
      const costModelB = calculateModelBPrice(totalChars);
      const cheaperModel = costModelA < costModelB ? 'Model A' : costModelA === costModelB ? 'Equal' : 'Model B';

      results.push({
        customer: profile.externalId,
        profile: profile.type,
        chars: totalChars,
        modelA: costModelA,
        modelB: costModelB,
        cheaper: cheaperModel,
        isFallback
      });
    }

    // 6. Print Comparison Table to Console
    console.log('\n========================================================================');
    console.log('📊 PRICING EXPERIMENT RESULTS COMPARISON');
    console.log('========================================================================');
    console.log(String('Customer').padEnd(16) + String('Profile').padEnd(10) + String('Total Chars').padEnd(14) + String('Model A ($)').padEnd(14) + String('Model B ($)').padEnd(14) + 'Cheaper');
    console.log('------------------------------------------------------------------------');
    
    for (const r of results) {
      console.log(
        r.customer.padEnd(16) + 
        r.profile.padEnd(10) + 
        r.chars.toLocaleString().padEnd(14) + 
        `$${r.modelA.toFixed(2)}`.padEnd(14) + 
        `$${r.modelB.toFixed(2)}`.padEnd(14) + 
        r.cheaper
      );
    }
    console.log('========================================================================');

    // 7. Write results to CSV file
    const csvHeader = 'Customer,Profile,Total Chars,Model A Price ($),Model B Price ($),Cheaper Model\n';
    const csvRows = results.map(r => `${r.customer},${r.profile},${r.chars},${r.modelA.toFixed(2)},${r.modelB.toFixed(2)},${r.cheaper}`).join('\n');
    const csvPath = path.resolve(__dirname, '../simulation-results.csv');
    
    fs.writeFileSync(csvPath, csvHeader + csvRows, 'utf8');
    console.log(`💾 Simulation results successfully written to: ${csvPath}`);

    // 8. Clean up simulated customer records from Flexprice
    console.log('\n🧹 Cleaning up simulation customer data from Flexprice...');
    for (const profile of PROFILES) {
      const subs = await flexpriceClient.get(`/customers/external/${profile.externalId}/subscriptions`).catch(() => ({ items: [] }));
      for (const sub of subs.items || []) {
        await flexpriceClient.post(`/subscriptions/${sub.id}/cancel`, { cancellation_type: 'immediate' }).catch(() => {});
      }
      await flexpriceClient.delete(`/customers/${customersMap[profile.externalId].flexpriceCustomerId}`).catch(() => {});
    }
    console.log('✅ Simulation data cleanup completed.');

    console.log('\n🎉 PRICING EXPERIMENT SIMULATION SCRIPT COMPLETED SUCCESSFULLY! 🎉');

  } catch (error) {
    console.error('\n❌ Pricing simulation failed!');
    console.error('Error Details:', error.message || error);
    process.exit(1);
  } finally {
    db.close();
  }
}

runSimulation();
