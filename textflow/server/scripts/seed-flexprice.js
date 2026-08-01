import flexpriceClient from '../src/flexprice/client.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');
const showHelp = args.includes('--help') || args.includes('-h');

if (showHelp) {
  console.log(`
📋 Flexprice Seeding Script for TextFlow SaaS

Usage:
  node scripts/seed-flexprice.js [options]

Options:
  --force      Delete existing plans/features and recreate them
  --dry-run    Display what would be created without making API calls
  --help, -h   Show this help message
`);
  process.exit(0);
}

// Helper to write to .env file safely
function updateEnvFile(updates) {
  const envPath = path.resolve(__dirname, '../.env');
  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  }

  // Backup existing .env file
  if (!isDryRun && content) {
    fs.writeFileSync(`${envPath}.bak`, content, 'utf8');
    console.log('💾 Created a backup of .env file at .env.bak');
  }

  let lines = content.split(/\r?\n/);
  
  for (const [key, value] of Object.entries(updates)) {
    let found = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith(`${key}=`)) {
        lines[i] = `${key}=${value}`;
        found = true;
        break;
      }
    }
    if (!found) {
      lines.push(`${key}=${value}`);
    }
  }

  if (!isDryRun) {
    fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
    console.log('✅ Environment variables written to .env file');
  } else {
    console.log('ℹ️ [Dry Run] Would write to .env:');
    console.log(updates);
  }
}

async function seed() {
  console.log(`🚀 Starting Flexprice database seeding (Mode: ${isDryRun ? 'DRY RUN' : isForce ? 'FORCE RECREATE' : 'IDEMPOTENT CHECK'})...`);

  try {
    // 0. Connection check
    await flexpriceClient.get('/customers');
    console.log('🔌 Connection to local Flexprice API successful.');

    // 1. Retrieve current features and plans
    let existingFeatures = [];
    let existingPlans = [];
    let existingPrices = [];
    let existingEntitlements = [];

    if (!isForce) {
      console.log('🔍 Fetching existing entities to preserve state...');
      const fRes = await flexpriceClient.get('/features');
      existingFeatures = fRes.items || [];
      
      const pRes = await flexpriceClient.get('/plans');
      existingPlans = pRes.items || [];

      const prRes = await flexpriceClient.get('/prices');
      existingPrices = prRes.items || [];

      const eRes = await flexpriceClient.get('/entitlements');
      existingEntitlements = eRes.items || [];
    } else {
      // Clean up existing seeded plans and features if force
      console.log('🗑️ Force flag set. Cleaning up existing plans/features...');
      
      const pRes = await flexpriceClient.get('/plans');
      for (const p of pRes.items || []) {
        if (p.lookup_key === 'free_plan' || p.lookup_key === 'pro_plan') {
          console.log(`   - Deleting plan ${p.name} (${p.id})...`);
          await flexpriceClient.delete(`/plans/${p.id}`).catch(() => {});
        }
      }

      const fRes = await flexpriceClient.get('/features');
      for (const f of fRes.items || []) {
        if (f.name === 'Characters Processed' || f.name === 'Tone Selector') {
          console.log(`   - Deleting feature ${f.name} (${f.id})...`);
          await flexpriceClient.delete(`/features/${f.id}`).catch(() => {});
        }
      }
    }

    let charFeatureId = '';
    let toneFeatureId = '';
    let charMeterId = '';
    let freePlanId = '';
    let proPlanId = '';

    // =========================================================================
    // Part B: Feature Creation
    // =========================================================================

    // 1. Metered Feature: Characters Processed
    console.log('\nStep 1: Setting up Metered Feature: "Characters Processed"...');
    const existingCharFeature = existingFeatures.find(f => f.name === 'Characters Processed');
    
    if (existingCharFeature) {
      console.log(`✅ Feature "Characters Processed" already exists. ID: ${existingCharFeature.id}`);
      charFeatureId = existingCharFeature.id;
      charMeterId = existingCharFeature.meter_id || existingCharFeature.meter?.id;
    } else {
      const charFeaturePayload = {
        name: 'Characters Processed',
        type: 'metered',
        unit_singular: 'character',
        unit_plural: 'characters',
        meter: {
          name: 'Characters Processed Meter',
          event_name: 'text_processed',
          aggregation: { type: 'SUM', field: 'char_count' },
          reset_usage: 'BILLING_PERIOD'
        }
      };

      if (!isDryRun) {
        const response = await flexpriceClient.post('/features', charFeaturePayload);
        charFeatureId = response.id;
        charMeterId = response.meter_id || response.meter?.id;
        console.log(`✅ Created Metered Feature: "Characters Processed". ID: ${charFeatureId}, Meter ID: ${charMeterId}`);
      } else {
        console.log('ℹ️ [Dry Run] Would create feature "Characters Processed"');
        charFeatureId = 'mock_char_feature_id';
        charMeterId = 'mock_char_meter_id';
      }
    }

    // 2. Boolean Feature: Tone Selector
    console.log('\nStep 2: Setting up Boolean Feature: "Tone Selector"...');
    const existingToneFeature = existingFeatures.find(f => f.name === 'Tone Selector');
    
    if (existingToneFeature) {
      console.log(`✅ Feature "Tone Selector" already exists. ID: ${existingToneFeature.id}`);
      toneFeatureId = existingToneFeature.id;
    } else {
      const toneFeaturePayload = {
        name: 'Tone Selector',
        type: 'boolean',
        description: 'Adjust rewrite tone: Professional, Casual, Academic, Creative'
      };

      if (!isDryRun) {
        const response = await flexpriceClient.post('/features', toneFeaturePayload);
        toneFeatureId = response.id;
        console.log(`✅ Created Boolean Feature: "Tone Selector". ID: ${toneFeatureId}`);
      } else {
        console.log('ℹ️ [Dry Run] Would create feature "Tone Selector"');
        toneFeatureId = 'mock_tone_feature_id';
      }
    }

    // =========================================================================
    // Part C: Plan Creation
    // =========================================================================

    // 1. Free Plan
    console.log('\nStep 3: Setting up Free Plan...');
    const existingFreePlan = existingPlans.find(p => p.lookup_key === 'free_plan');
    
    if (existingFreePlan) {
      console.log(`✅ Plan "Free" already exists. ID: ${existingFreePlan.id}`);
      freePlanId = existingFreePlan.id;
    } else {
      const freePlanPayload = {
        name: 'Free',
        lookup_key: 'free_plan',
        description: 'Free tier — 2,000 characters/month'
      };

      if (!isDryRun) {
        const response = await flexpriceClient.post('/plans', freePlanPayload);
        freePlanId = response.id;
        console.log(`✅ Created Free Plan. ID: ${freePlanId}`);
      } else {
        console.log('ℹ️ [Dry Run] Would create plan "Free"');
        freePlanId = 'mock_free_plan_id';
      }
    }

    // 2. Pro Plan
    console.log('\nStep 4: Setting up Pro Plan...');
    const existingProPlan = existingPlans.find(p => p.lookup_key === 'pro_plan');
    
    if (existingProPlan) {
      console.log(`✅ Plan "Pro" already exists. ID: ${existingProPlan.id}`);
      proPlanId = existingProPlan.id;
    } else {
      const proPlanPayload = {
        name: 'Pro',
        lookup_key: 'pro_plan',
        description: 'Pro tier — 50,000 characters/month + tone control'
      };

      if (!isDryRun) {
        const response = await flexpriceClient.post('/plans', proPlanPayload);
        proPlanId = response.id;
        console.log(`✅ Created Pro Plan. ID: ${proPlanId}`);
      } else {
        console.log('ℹ️ [Dry Run] Would create plan "Pro"');
        proPlanId = 'mock_pro_plan_id';
      }
    }

    // =========================================================================
    // Part D: Entitlement Creation
    // =========================================================================
    console.log('\nStep 5: Setting up Entitlements...');

    // Free Plan - Metered Entitlement
    const freeCharEnt = existingEntitlements.find(e => e.plan_id === freePlanId && e.feature_id === charFeatureId);
    if (freeCharEnt) {
      console.log('✅ Entitlement: "Free plan -> Characters Processed" already exists.');
    } else {
      const payload = {
        plan_id: freePlanId,
        feature_id: charFeatureId,
        feature_type: 'metered',
        usage_limit: 2000,
        usage_reset_period: 'MONTHLY',
        is_soft_limit: false,
        is_enabled: true
      };
      if (!isDryRun) {
        await flexpriceClient.post('/entitlements', payload);
        console.log('✅ Created entitlement: Free Plan -> Characters Processed (2,000 limit)');
      } else {
        console.log('ℹ️ [Dry Run] Would create entitlement: Free Plan -> Characters Processed (2k)');
      }
    }

    // Free Plan - Boolean Entitlement (disabled)
    const freeToneEnt = existingEntitlements.find(e => e.plan_id === freePlanId && e.feature_id === toneFeatureId);
    if (freeToneEnt) {
      console.log('✅ Entitlement: "Free plan -> Tone Selector" already exists.');
    } else {
      const payload = {
        plan_id: freePlanId,
        feature_id: toneFeatureId,
        feature_type: 'boolean',
        is_enabled: false
      };
      if (!isDryRun) {
        await flexpriceClient.post('/entitlements', payload);
        console.log('✅ Created entitlement: Free Plan -> Tone Selector (Disabled)');
      } else {
        console.log('ℹ️ [Dry Run] Would create entitlement: Free Plan -> Tone Selector (Disabled)');
      }
    }

    // Pro Plan - Metered Entitlement
    const proCharEnt = existingEntitlements.find(e => e.plan_id === proPlanId && e.feature_id === charFeatureId);
    if (proCharEnt) {
      console.log('✅ Entitlement: "Pro plan -> Characters Processed" already exists.');
    } else {
      const payload = {
        plan_id: proPlanId,
        feature_id: charFeatureId,
        feature_type: 'metered',
        usage_limit: 50000,
        usage_reset_period: 'MONTHLY',
        is_soft_limit: false,
        is_enabled: true
      };
      if (!isDryRun) {
        await flexpriceClient.post('/entitlements', payload);
        console.log('✅ Created entitlement: Pro Plan -> Characters Processed (50,000 limit)');
      } else {
        console.log('ℹ️ [Dry Run] Would create entitlement: Pro Plan -> Characters Processed (50k)');
      }
    }

    // Pro Plan - Boolean Entitlement (enabled)
    const proToneEnt = existingEntitlements.find(e => e.plan_id === proPlanId && e.feature_id === toneFeatureId);
    if (proToneEnt) {
      console.log('✅ Entitlement: "Pro plan -> Tone Selector" already exists.');
    } else {
      const payload = {
        plan_id: proPlanId,
        feature_id: toneFeatureId,
        feature_type: 'boolean',
        is_enabled: true
      };
      if (!isDryRun) {
        await flexpriceClient.post('/entitlements', payload);
        console.log('✅ Created entitlement: Pro Plan -> Tone Selector (Enabled)');
      } else {
        console.log('ℹ️ [Dry Run] Would create entitlement: Pro Plan -> Tone Selector (Enabled)');
      }
    }

    // =========================================================================
    // Part E: Pricing Configuration
    // =========================================================================
    console.log('\nStep 6: Setting up Prices on Plans...');

    // Free Plan - Fixed Flat Fee ($0.00)
    const hasFreeFixedPrice = existingPrices.find(p => p.entity_id === freePlanId && p.type === 'FIXED');
    if (hasFreeFixedPrice) {
      console.log('✅ Price: "Free plan -> Fixed Flat Fee ($0.00)" already exists.');
    } else {
      const payload = {
        type: 'FIXED',
        billing_model: 'FLAT_FEE',
        entity_type: 'PLAN',
        entity_id: freePlanId,
        currency: 'usd',
        amount: '0.00',
        billing_period: 'MONTHLY',
        billing_period_count: 1,
        price_unit_type: 'FIAT',
        invoice_cadence: 'ADVANCE'
      };
      if (!isDryRun) {
        await flexpriceClient.post('/prices', payload);
        console.log('✅ Created flat monthly base fee ($0.00) for Free Plan.');
      } else {
        console.log('ℹ️ [Dry Run] Would create flat price ($0.00) for Free');
      }
    }

    // Pro Plan - Fixed Flat Fee
    const hasFixedPrice = existingPrices.find(p => p.entity_id === proPlanId && p.type === 'FIXED');
    if (hasFixedPrice) {
      console.log('✅ Price: "Pro plan -> Fixed Flat Fee ($9.00)" already exists.');
    } else {
      const payload = {
        type: 'FIXED',
        billing_model: 'FLAT_FEE',
        entity_type: 'PLAN',
        entity_id: proPlanId,
        currency: 'usd',
        amount: '9.00',
        billing_period: 'MONTHLY',
        billing_period_count: 1,
        price_unit_type: 'FIAT',
        invoice_cadence: 'ADVANCE'
      };
      if (!isDryRun) {
        await flexpriceClient.post('/prices', payload);
        console.log('✅ Created flat monthly base fee ($9.00) for Pro Plan.');
      } else {
        console.log('ℹ️ [Dry Run] Would create flat price ($9.00) for Pro');
      }
    }

    // Pro Plan - Usage Package Fee
    const hasUsagePrice = existingPrices.find(p => p.entity_id === proPlanId && p.type === 'USAGE');
    if (hasUsagePrice) {
      console.log('✅ Price: "Pro plan -> Usage Price ($0.50 per 1000 characters)" already exists.');
    } else {
      const payload = {
        type: 'USAGE',
        billing_model: 'PACKAGE',
        entity_type: 'PLAN',
        entity_id: proPlanId,
        meter_id: charMeterId,
        currency: 'usd',
        amount: '0.50',
        billing_period: 'MONTHLY',
        billing_period_count: 1,
        price_unit_type: 'FIAT',
        invoice_cadence: 'ARREAR',
        transform_quantity: { divide_by: 1000 }
      };
      if (!isDryRun) {
        await flexpriceClient.post('/prices', payload);
        console.log('✅ Created usage package pricing ($0.50 per 1,000 characters) for Pro Plan.');
      } else {
        console.log('ℹ️ [Dry Run] Would create usage price ($0.50 per 1k chars) for Pro');
      }
    }

    // =========================================================================
    // Part F: Environment Updates
    // =========================================================================
    console.log('\nStep 7: Syncing entity IDs with environment configuration...');
    const updates = {
      FREE_PLAN_ID: freePlanId,
      PRO_PLAN_ID: proPlanId,
      CHAR_FEATURE_ID: charFeatureId,
      TONE_FEATURE_ID: toneFeatureId,
      CHAR_METER_ID: charMeterId
    };

    updateEnvFile(updates);

    console.log('\n🎉 FLEXPRICE SEEDING SCRIPT COMPLETED SUCCESSFULLY! 🎉');

  } catch (error) {
    console.error('\n❌ Seeding process failed!');
    console.error('Error Details:', error.message || error);
    if (error.details) {
      console.error('API Error details:', JSON.stringify(error.details, null, 2));
    }
    process.exit(1);
  }
}

seed();
