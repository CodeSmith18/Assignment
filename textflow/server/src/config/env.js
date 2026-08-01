import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server root directory
dotenv.config({ path: path.join(__dirname, '../../.env') });

const requiredVars = [
  'PORT',
  'SESSION_SECRET',
  'CLIENT_ORIGIN',
  'FLEXPRICE_BASE_URL',
  'FLEXPRICE_API_KEY'
];

export function validateEnv() {
  const missing = [];
  
  for (const name of requiredVars) {
    if (!process.env[name]) {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    console.error('❌ Critical configuration error: Missing environment variables:');
    for (const name of missing) {
      console.error(`   - ${name}`);
    }
    process.exit(1);
  }

  console.log('✅ Environment configuration validated successfully');
}

export const config = {
  port: process.env.PORT || 4000,
  sessionSecret: process.env.SESSION_SECRET,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  flexpriceBaseUrl: process.env.FLEXPRICE_BASE_URL,
  flexpriceApiKey: process.env.FLEXPRICE_API_KEY,
  huggingfaceApiToken: process.env.HUGGINGFACE_API_TOKEN,
  // Flexprice seeded entities (populated later)
  freePlanId: process.env.FREE_PLAN_ID,
  proPlanId: process.env.PRO_PLAN_ID,
  charFeatureId: process.env.CHAR_FEATURE_ID,
  toneFeatureId: process.env.TONE_FEATURE_ID,
  charMeterId: process.env.CHAR_METER_ID
};
