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
        if (['free_plan', 'pro_plan', 'payg_plan'].includes(p.lookup_key)) {
          console.log(`   - Deleting plan ${p.name} (${p.id})...`);
          await flexpriceClient.delete(`/plans/${p.id}`).catch(() => {});
        }
      }

      const fRes = await flexpriceClient.get('/features');
      for (const f of fRes.items || []) {
        if (['Characters Processed', 'Characters Summarized', 'Characters Rewritten', 'Tone Selector'].includes(f.name)) {
          console.log(`   - Deleting feature ${f.name} (${f.id})...`);
          await flexpriceClient.delete(`/features/${f.id}`).catch(() => {});
        }
      }
    }

    let charSummarizedFeatureId = '';
    let charSummarizedMeterId = '';
    let charRewrittenFeatureId = '';
    let charRewrittenMeterId = '';
    let toneFeatureId = '';
    let freePlanId = '';
    let proPlanId = '';
    let paygPlanId = '';

    // =========================================================================
    // Part B: Feature Creation
    // =========================================================================

    // 1a. Metered Feature: Characters Summarized
    console.log('\nStep 1a: Setting up Metered Feature: "Characters Summarized"...');
    const existingSumFeature = existingFeatures.find(f => f.name === 'Characters Summarized');
    
    if (existingSumFeature) {
      console.log(`✅ Feature "Characters Summarized" already exists. ID: ${existingSumFeature.id}`);
      charSummarizedFeatureId = existingSumFeature.id;
      charSummarizedMeterId = existingSumFeature.meter_id || existingSumFeature.meter?.id;
    } else {
      const payload = {
        name: 'Characters Summarized',
        lookup_key: 'characters_summarized',
        type: 'metered',
        unit_singular: 'character',
        unit_plural: 'characters',
        meter: {
          name: 'Characters Summarized Meter',
          event_name: 'text_processed',
          aggregation: { type: 'SUM', field: 'char_count' },
          filters: [
            { key: 'operation_type', values: ['summarize'] }
          ],
          reset_usage: 'BILLING_PERIOD'
        }
      };

      if (!isDryRun) {
        const response = await flexpriceClient.post('/features', payload);
        charSummarizedFeatureId = response.id;
        charSummarizedMeterId = response.meter_id || response.meter?.id;
        console.log(`✅ Created Feature: "Characters Summarized". ID: ${charSummarizedFeatureId}, Meter ID: ${charSummarizedMeterId}`);
      } else {
        console.log('ℹ️ [Dry Run] Would create feature "Characters Summarized"');
        charSummarizedFeatureId = 'mock_sum_feature_id';
        charSummarizedMeterId = 'mock_sum_meter_id';
      }
    }

    // 1b. Metered Feature: Characters Rewritten
    console.log('\nStep 1b: Setting up Metered Feature: "Characters Rewritten"...');
    const existingRewriteFeature = existingFeatures.find(f => f.name === 'Characters Rewritten');
    
    if (existingRewriteFeature) {
      console.log(`✅ Feature "Characters Rewritten" already exists. ID: ${existingRewriteFeature.id}`);
      charRewrittenFeatureId = existingRewriteFeature.id;
      charRewrittenMeterId = existingRewriteFeature.meter_id || existingRewriteFeature.meter?.id;
    } else {
      const payload = {
        name: 'Characters Rewritten',
        lookup_key: 'characters_rewritten',
        type: 'metered',
        unit_singular: 'character',
        unit_plural: 'characters',
        meter: {
          name: 'Characters Rewritten Meter',
          event_name: 'text_processed',
          aggregation: { type: 'SUM', field: 'char_count' },
          filters: [
            { key: 'operation_type', values: ['rewrite'] }
          ],
          reset_usage: 'BILLING_PERIOD'
        }
      };

      if (!isDryRun) {
        const response = await flexpriceClient.post('/features', payload);
        charRewrittenFeatureId = response.id;
        charRewrittenMeterId = response.meter_id || response.meter?.id;
        console.log(`✅ Created Feature: "Characters Rewritten". ID: ${charRewrittenFeatureId}, Meter ID: ${charRewrittenMeterId}`);
      } else {
        console.log('ℹ️ [Dry Run] Would create feature "Characters Rewritten"');
        charRewrittenFeatureId = 'mock_rewrite_feature_id';
        charRewrittenMeterId = 'mock_rewrite_meter_id';
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

    // 3. Pay-As-You-Go Plan
    console.log('\nStep 4b: Setting up Pay-As-You-Go Plan...');
    const existingPaygPlan = existingPlans.find(p => p.lookup_key === 'payg_plan');
    
    if (existingPaygPlan) {
      console.log(`✅ Plan "Pay-As-You-Go" already exists. ID: ${existingPaygPlan.id}`);
      paygPlanId = existingPaygPlan.id;
    } else {
      const paygPlanPayload = {
        name: 'Pay-As-You-Go',
        lookup_key: 'payg_plan',
        description: 'Pay only what you use — Metered billing'
      };

      if (!isDryRun) {
        const response = await flexpriceClient.post('/plans', paygPlanPayload);
        paygPlanId = response.id;
        console.log(`✅ Created Pay-As-You-Go Plan. ID: ${paygPlanId}`);
      } else {
        console.log('ℹ️ [Dry Run] Would create plan "Pay-As-You-Go"');
        paygPlanId = 'mock_payg_plan_id';
      }
    }

    // =========================================================================
    // Part D: Entitlement Creation
    // =========================================================================
    console.log('\nStep 5: Setting up Entitlements...');

    const entitlementsToCreate = [
      // FREE PLAN
      { plan_id: freePlanId, feature_id: charSummarizedFeatureId, feature_type: 'metered', usage_limit: 2000, usage_reset_period: 'MONTHLY', is_soft_limit: false, is_enabled: true },
      { plan_id: freePlanId, feature_id: charRewrittenFeatureId, feature_type: 'metered', usage_limit: 2000, usage_reset_period: 'MONTHLY', is_soft_limit: false, is_enabled: true },
      { plan_id: freePlanId, feature_id: toneFeatureId, feature_type: 'boolean', is_enabled: false },

      // PRO PLAN
      { plan_id: proPlanId, feature_id: charSummarizedFeatureId, feature_type: 'metered', usage_limit: 50000, usage_reset_period: 'MONTHLY', is_soft_limit: false, is_enabled: true },
      { plan_id: proPlanId, feature_id: charRewrittenFeatureId, feature_type: 'metered', usage_limit: 50000, usage_reset_period: 'MONTHLY', is_soft_limit: false, is_enabled: true },
      { plan_id: proPlanId, feature_id: toneFeatureId, feature_type: 'boolean', is_enabled: true },

      // PAY-AS-YOU-GO PLAN
      { plan_id: paygPlanId, feature_id: charSummarizedFeatureId, feature_type: 'metered', usage_limit: 0, usage_reset_period: 'MONTHLY', is_soft_limit: true, is_enabled: true },
      { plan_id: paygPlanId, feature_id: charRewrittenFeatureId, feature_type: 'metered', usage_limit: 0, usage_reset_period: 'MONTHLY', is_soft_limit: true, is_enabled: true },
      { plan_id: paygPlanId, feature_id: toneFeatureId, feature_type: 'boolean', is_enabled: true },
    ];

    for (const ent of entitlementsToCreate) {
      const exists = existingEntitlements.find(e => e.plan_id === ent.plan_id && e.feature_id === ent.feature_id);
      if (exists) {
        console.log(`✅ Entitlement for plan ${ent.plan_id} and feature ${ent.feature_id} already exists.`);
        continue;
      }

      if (!isDryRun) {
        await flexpriceClient.post('/entitlements', ent);
        console.log(`✅ Created entitlement on plan ${ent.plan_id} for feature ${ent.feature_id}`);
      } else {
        console.log(`ℹ️ [Dry Run] Would create entitlement for plan ${ent.plan_id} for feature ${ent.feature_id}`);
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

    // Pro Plan - Fixed Flat Fee ($9.00)
    const hasProFixedPrice = existingPrices.find(p => p.entity_id === proPlanId && p.type === 'FIXED');
    if (hasProFixedPrice) {
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

    // PAY-AS-YOU-GO: Summarization Price ($0.80 per 1,000 characters -> $0.0008 unit)
    const hasPaygSumPrice = existingPrices.find(p => p.entity_id === paygPlanId && p.meter_id === charSummarizedMeterId);
    if (hasPaygSumPrice) {
      console.log('✅ Price: "Pay-As-You-Go -> Summarization Price ($0.80 per 1000 characters)" already exists.');
    } else {
      const payload = {
        type: 'USAGE',
        billing_model: 'PACKAGE',
        entity_type: 'PLAN',
        entity_id: paygPlanId,
        meter_id: charSummarizedMeterId,
        currency: 'usd',
        amount: '0.80',
        billing_period: 'MONTHLY',
        billing_period_count: 1,
        price_unit_type: 'FIAT',
        invoice_cadence: 'ARREAR',
        transform_quantity: { divide_by: 1000 }
      };
      if (!isDryRun) {
        await flexpriceClient.post('/prices', payload);
        console.log('✅ Created usage pricing ($0.80/1k characters) for Pay-As-You-Go Summarization.');
      } else {
        console.log('ℹ️ [Dry Run] Would create usage price ($0.80/1k chars) for PAYG Sum');
      }
    }

    // PAY-AS-YOU-GO: Rewrite Price ($1.00 per 1,000 characters -> $0.001 unit)
    const hasPaygRewritePrice = existingPrices.find(p => p.entity_id === paygPlanId && p.meter_id === charRewrittenMeterId);
    if (hasPaygRewritePrice) {
      console.log('✅ Price: "Pay-As-You-Go -> Rewrite Price ($1.00 per 1000 characters)" already exists.');
    } else {
      const payload = {
        type: 'USAGE',
        billing_model: 'PACKAGE',
        entity_type: 'PLAN',
        entity_id: paygPlanId,
        meter_id: charRewrittenMeterId,
        currency: 'usd',
        amount: '1.00',
        billing_period: 'MONTHLY',
        billing_period_count: 1,
        price_unit_type: 'FIAT',
        invoice_cadence: 'ARREAR',
        transform_quantity: { divide_by: 1000 }
      };
      if (!isDryRun) {
        await flexpriceClient.post('/prices', payload);
        console.log('✅ Created usage pricing ($1.00/1k characters) for Pay-As-You-Go Rewrite.');
      } else {
        console.log('ℹ️ [Dry Run] Would create usage price ($1.00/1k chars) for PAYG Rewrite');
      }
    }

    // =========================================================================
    // Part F: Environment Updates
    // =========================================================================
    console.log('\nStep 7: Syncing entity IDs with environment configuration...');
    const updates = {
      FREE_PLAN_ID: freePlanId,
      PRO_PLAN_ID: proPlanId,
      PAYG_PLAN_ID: paygPlanId,
      CHAR_SUMMARIZED_FEATURE_ID: charSummarizedFeatureId,
      CHAR_REWRITTEN_FEATURE_ID: charRewrittenFeatureId,
      CHAR_SUMMARIZED_METER_ID: charSummarizedMeterId,
      CHAR_REWRITTEN_METER_ID: charRewrittenMeterId,
      TONE_FEATURE_ID: toneFeatureId
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
