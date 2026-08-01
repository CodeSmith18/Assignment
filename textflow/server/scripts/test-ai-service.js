import { summarize, rewrite, performanceMetrics } from '../src/services/aiService.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env') });

async function runTests() {
  console.log('🧪 Starting AI Service Integration Tests...');
  console.log(`Mock AI Mode is: ${process.env.MOCK_AI === 'true' ? 'ACTIVE' : 'INACTIVE'}`);

  try {
    // -------------------------------------------------------------------------
    // Test 1: Summarize validation (Too Short)
    // -------------------------------------------------------------------------
    console.log('\nTest 1: Summarize text that is too short...');
    const shortText = 'This is a short sentence.';
    const res1 = await summarize(shortText, 'free');
    console.log('Result:', JSON.stringify(res1, null, 2));
    if (res1.success === false && res1.error === 'text_too_short') {
      console.log('✅ Correctly rejected text that was too short.');
    } else {
      throw new Error('Failed to validate short text length.');
    }

    // -------------------------------------------------------------------------
    // Test 2: Summarize validation (Too Long for Free plan)
    // -------------------------------------------------------------------------
    console.log('\nTest 2: Summarize text that exceeds Free plan limits (1000+ chars)...');
    const longTextFree = 'A '.repeat(1050); // 1050 chars
    const res2 = await summarize(longTextFree, 'free');
    console.log('Result:', JSON.stringify(res2, null, 2));
    if (res2.success === false && res2.error === 'text_too_long') {
      console.log('✅ Correctly rejected text exceeding Free plan limits.');
    } else {
      throw new Error('Failed to validate Free plan length bounds.');
    }

    // -------------------------------------------------------------------------
    // Test 3: Summarize successful case
    // -------------------------------------------------------------------------
    console.log('\nTest 3: Summarizing valid text (120 chars)...');
    const validText = 'The quick brown fox jumps over the lazy dog. This is another sentence of significance. We need enough sentences to make sure it summaries nicely. Here is a final statement.';
    const res3 = await summarize(validText, 'free');
    console.log('Result:', JSON.stringify(res3, null, 2));
    if (res3.success === true && res3.summary && res3.compressionRatio <= 1.0) {
      console.log('✅ Summarization completed successfully!');
      console.log('Summary:', res3.summary);
    } else {
      throw new Error('Failed to summarize text.');
    }

    // -------------------------------------------------------------------------
    // Test 4: Rewrite validation (Too Short)
    // -------------------------------------------------------------------------
    console.log('\nTest 4: Rewrite text that is too short...');
    const res4 = await rewrite('a', 'default', 'free');
    console.log('Result:', JSON.stringify(res4, null, 2));
    if (res4.success === false && res4.error === 'text_too_short') {
      console.log('✅ Correctly rejected rewriting short text.');
    } else {
      throw new Error('Failed to validate rewrite text length.');
    }

    // -------------------------------------------------------------------------
    // Test 5: Rewrite with default tone
    // -------------------------------------------------------------------------
    console.log('\nTest 5: Paraphrase rewriting (Default Tone)...');
    const textToParaphrase = 'Developing software is really happy work, but sometimes it gets slow.';
    const res5 = await rewrite(textToParaphrase, 'default', 'free');
    console.log('Result:', JSON.stringify(res5, null, 2));
    if (res5.success === true && res5.rewrittenText !== textToParaphrase) {
      console.log('✅ Paraphrase rewrite successful!');
      console.log('Original:', textToParaphrase);
      console.log('Rewritten:', res5.rewrittenText);
    } else {
      throw new Error('Failed default rewrite.');
    }

    // -------------------------------------------------------------------------
    // Test 6: Rewrite with professional tone
    // -------------------------------------------------------------------------
    console.log('\nTest 6: Rewriting with Professional Tone...');
    const res6 = await rewrite(textToParaphrase, 'professional', 'pro');
    console.log('Result:', JSON.stringify(res6, null, 2));
    if (res6.success === true && res6.tone === 'professional' && res6.rewrittenText.includes('professional perspective')) {
      console.log('✅ Professional rewrite completed successfully!');
      console.log('Rewritten:', res6.rewrittenText);
    } else {
      throw new Error('Failed professional rewrite.');
    }

    // -------------------------------------------------------------------------
    // Test 7: Rewrite with casual tone
    // -------------------------------------------------------------------------
    console.log('\nTest 7: Rewriting with Casual Tone...');
    const res7 = await rewrite(textToParaphrase, 'casual', 'pro');
    console.log('Result:', JSON.stringify(res7, null, 2));
    if (res7.success === true && res7.tone === 'casual' && res7.rewrittenText.includes('casual way')) {
      console.log('✅ Casual rewrite completed successfully!');
      console.log('Rewritten:', res7.rewrittenText);
    } else {
      throw new Error('Failed casual rewrite.');
    }

    // -------------------------------------------------------------------------
    // Test 8: Rewrite with creative tone
    // -------------------------------------------------------------------------
    console.log('\nTest 8: Rewriting with Creative Tone...');
    const res8 = await rewrite(textToParaphrase, 'creative', 'pro');
    console.log('Result:', JSON.stringify(res8, null, 2));
    if (res8.success === true && res8.tone === 'creative' && res8.rewrittenText.includes('creative reimagining')) {
      console.log('✅ Creative rewrite completed successfully!');
      console.log('Rewritten:', res8.rewrittenText);
    } else {
      throw new Error('Failed creative rewrite.');
    }

    // -------------------------------------------------------------------------
    // Test 9: Rewrite with academic tone
    // -------------------------------------------------------------------------
    console.log('\nTest 9: Rewriting with Academic Tone...');
    const res9 = await rewrite(textToParaphrase, 'academic', 'pro');
    console.log('Result:', JSON.stringify(res9, null, 2));
    if (res9.success === true && res9.tone === 'academic' && res9.rewrittenText.includes('Scholarly reformulation')) {
      console.log('✅ Academic rewrite completed successfully!');
      console.log('Rewritten:', res9.rewrittenText);
    } else {
      throw new Error('Failed academic rewrite.');
    }

    // -------------------------------------------------------------------------
    // Test 10: Performance metrics checking
    // -------------------------------------------------------------------------
    console.log('\nTest 10: Inspecting rolling average performance metrics...');
    console.log('Metrics:', JSON.stringify(performanceMetrics, null, 2));
    if (performanceMetrics.requestCount > 0 && performanceMetrics.successCount > 0) {
      console.log('✅ Performance metrics tracked successfully!');
    } else {
      throw new Error('Failed to track metrics.');
    }

    console.log('\n🎉 ALL AI SERVICE INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');

  } catch (error) {
    console.error('\n❌ AI Service test suite failed!');
    console.error('Error Details:', error.message || error);
    process.exit(1);
  }
}

runTests();
