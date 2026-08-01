import axios from 'axios';
import { config } from '../config/env.js';

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = (parseInt(process.env.AI_CACHE_TTL) || 300) * 1000; // default 5 mins

// Rolling average metrics
export const performanceMetrics = {
  requestCount: 0,
  successCount: 0,
  errorCount: 0,
  averageResponseTime: 0,
  lastApiCall: null
};

function updateMetrics(success, responseTime) {
  performanceMetrics.requestCount++;
  if (success) performanceMetrics.successCount++;
  else performanceMetrics.errorCount++;
  
  // Rolling average (90% historical weight, 10% new weight)
  performanceMetrics.averageResponseTime = 
    performanceMetrics.averageResponseTime === 0
      ? responseTime
      : (performanceMetrics.averageResponseTime * 0.9) + (responseTime * 0.1);
      
  performanceMetrics.lastApiCall = new Date();
}

/**
 * Clean up text inputs by trimming whitespace and normalizing line endings.
 */
function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Validates inputs based on user's active plan.
 */
function validateInput(text, userPlan, minLength, defaultMaxFree = 1000, defaultMaxPro = 8000) {
  const sanitized = sanitizeText(text);
  const userPlanNormalized = (userPlan || 'free').toLowerCase();
  const maxLength = userPlanNormalized === 'pro' ? defaultMaxPro : defaultMaxFree;

  if (sanitized.length < minLength) {
    return {
      valid: false,
      error: 'text_too_short',
      message: `Text must be at least ${minLength} characters long.`
    };
  }

  if (sanitized.length > maxLength) {
    return {
      valid: false,
      error: 'text_too_long',
      message: `Text length (${sanitized.length}) exceeds your plan limit of ${maxLength} characters. ${userPlanNormalized === 'free' ? 'Upgrade to Pro for longer text processing.' : ''}`
    };
  }

  return { valid: true, sanitized };
}

/**
 * Extractive summarization fallback
 */
export function extractiveSummaryFallback(text) {
  const cleaned = text.trim();
  const sentences = cleaned.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 5);
  
  if (sentences.length <= 3) return cleaned;
  
  const firstSentence = sentences[0];
  const middleSentence = sentences[Math.floor(sentences.length / 2)];
  const lastSentence = sentences[sentences.length - 1];
  
  return `${firstSentence}. ${middleSentence}. ${lastSentence}.`.trim();
}

/**
 * Mock paraphrase rewrite fallback
 */
export function mockRewriteFallback(text, tone) {
  const cleaned = text.trim();
  
  // Basic synonym replacements
  let rewritten = cleaned
    .replace(/\b(very|really|extremely)\s+/gi, 'considerably ')
    .replace(/\b(good)\b/gi, 'excellent')
    .replace(/\b(bad)\b/gi, 'problematic')
    .replace(/\b(happy)\b/gi, 'delighted')
    .replace(/\b(sad)\b/gi, 'gloomy')
    .replace(/\b(fast)\b/gi, 'rapid')
    .replace(/\b(slow)\b/gi, 'leisurely');

  const toneNormalized = (tone || 'default').toLowerCase();

  switch (toneNormalized) {
    case 'professional':
      return `From a professional perspective: "${rewritten}". This phrasing maintains a formal communication structure suitable for corporate environments.`;
    case 'casual':
      return `Here is a casual way to put it: "${rewritten.replace(/\bdo not\b/gi, "don't").replace(/\bcannot\b/gi, "can't").replace(/\bhello\b/gi, "hey")}". Hope that sounds friendly!`;
    case 'academic':
      return `Scholarly reformulation: "${rewritten}". This articulation aligns with precise academic paradigms and formal lexical standards.`;
    case 'creative':
      return `A creative reimagining: "${rewritten}". Spreading a touch of artistry across the original words.`;
    case 'default':
    default:
      return `Rewritten phrasing: "${rewritten}"`;
  }
}

/**
 * Helper to make robust API requests to Hugging Face with retries and exponential backoff
 */
async function callHuggingFace(url, payload, retries = 3, delay = 2000) {
  const token = config.huggingfaceApiToken || process.env.HUGGINGFACE_API_TOKEN;
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 seconds
      });
      return response.data;
    } catch (err) {
      const status = err.response?.status;
      
      // If rate limited (429) or model loading (503), retry
      if ((status === 429 || status === 503) && i < retries - 1) {
        const backoff = delay * Math.pow(2, i);
        console.warn(`[AI Service] Hugging Face API returned status ${status}. Retrying in ${backoff}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }
      
      throw err;
    }
  }
  throw new Error('Hugging Face API call failed after max retries.');
}

/**
 * Summarizes text using Hugging Face (BART model) or falls back to mock logic
 * @param {string} text - The input text
 * @param {string} userPlan - User plan name ('free' or 'pro')
 * @returns {Promise<object>} Summary result
 */
export async function summarize(text, userPlan = 'free') {
  const startTime = Date.now();
  const validation = validateInput(text, userPlan, 50, 1000, 8000);
  
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      message: validation.message,
      originalLength: text?.length || 0
    };
  }

  const cleanText = validation.sanitized;
  const cacheKey = `summarize:${cleanText}`;
  
  // Check Cache
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    console.log('[AI Service] Serving summary from cache');
    return cached.data;
  }

  const isMockMode = process.env.MOCK_AI === 'true' || !config.huggingfaceApiToken || !config.huggingfaceApiToken.startsWith('hf_');

  if (isMockMode) {
    // Return high-quality mock/extractive summary
    const summary = extractiveSummaryFallback(cleanText);
    const result = {
      success: true,
      summary,
      fallback: true,
      reason: 'mock_mode_active',
      originalLength: cleanText.length,
      summaryLength: summary.length,
      compressionRatio: parseFloat((summary.length / cleanText.length).toFixed(2)),
      model: 'mock-extractive-bart',
      processingTime: parseFloat(((Date.now() - startTime) / 1000).toFixed(2))
    };

    cache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL });
    updateMetrics(true, result.processingTime);
    return result;
  }

  try {
    const url = 'https://api-inference.huggingface.co/models/facebook/bart-large-cnn';
    const payload = {
      inputs: cleanText,
      parameters: {
        max_length: Math.min(150, Math.floor(cleanText.length * 0.3)),
        min_length: 30,
        do_sample: false
      }
    };

    const data = await callHuggingFace(url, payload, parseInt(process.env.AI_MAX_RETRIES) || 3);
    const summary = data[0]?.summary_text || extractiveSummaryFallback(cleanText);
    
    const result = {
      success: true,
      summary,
      originalLength: cleanText.length,
      summaryLength: summary.length,
      compressionRatio: parseFloat((summary.length / cleanText.length).toFixed(2)),
      model: 'facebook/bart-large-cnn',
      processingTime: parseFloat(((Date.now() - startTime) / 1000).toFixed(2))
    };

    cache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL });
    updateMetrics(true, result.processingTime);
    return result;

  } catch (error) {
    console.error('[AI Service] Summarization API failed, serving fallback:', error.message || error);
    
    // Extractive fallback
    const summary = extractiveSummaryFallback(cleanText);
    const result = {
      success: true,
      summary,
      fallback: true,
      reason: 'huggingface_api_unavailable',
      originalLength: cleanText.length,
      summaryLength: summary.length,
      processingTime: parseFloat(((Date.now() - startTime) / 1000).toFixed(2))
    };

    updateMetrics(false, result.processingTime);
    return result;
  }
}

/**
 * Rewrites text with optional tone adjustment using Hugging Face (T5 model) or falls back to mock logic
 * @param {string} text - The input text
 * @param {string} tone - Selected tone ('default', 'professional', 'casual', 'academic', 'creative')
 * @param {string} userPlan - User plan name ('free' or 'pro')
 * @returns {Promise<object>} Rewritten result
 */
export async function rewrite(text, tone = 'default', userPlan = 'free') {
  const startTime = Date.now();
  const validation = validateInput(text, userPlan, 10, 1000, 8000);

  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      message: validation.message,
      originalLength: text?.length || 0
    };
  }

  const cleanText = validation.sanitized;
  const toneClean = (tone || 'default').toLowerCase();
  const cacheKey = `rewrite:${toneClean}:${cleanText}`;

  // Check Cache
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    console.log('[AI Service] Serving rewrite from cache');
    return cached.data;
  }

  const isMockMode = process.env.MOCK_AI === 'true' || !config.huggingfaceApiToken || !config.huggingfaceApiToken.startsWith('hf_');

  if (isMockMode) {
    const rewrittenText = mockRewriteFallback(cleanText, toneClean);
    const result = {
      success: true,
      rewrittenText,
      originalText: cleanText,
      tone: toneClean,
      originalLength: cleanText.length,
      rewrittenLength: rewrittenText.length,
      model: 'mock-paraphrase-t5',
      processingTime: parseFloat(((Date.now() - startTime) / 1000).toFixed(2))
    };

    cache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL });
    updateMetrics(true, result.processingTime);
    return result;
  }

  try {
    const TONE_PROMPTS = {
      'default': 'paraphrase: ',
      'professional': 'Rewrite the following text in a professional business tone: ',
      'casual': 'Rewrite the following text in a casual, conversational tone: ',
      'academic': 'Rewrite the following text in an academic, scholarly tone: ',
      'creative': 'Rewrite the following text in a creative, engaging tone: '
    };

    const promptPrefix = TONE_PROMPTS[toneClean] || TONE_PROMPTS.default;
    const url = 'https://api-inference.huggingface.co/models/t5-base';
    const payload = {
      inputs: `${promptPrefix}${cleanText}`,
      parameters: {
        max_length: Math.min(512, cleanText.length + 50),
        min_length: Math.max(10, Math.floor(cleanText.length * 0.8)),
        do_sample: true,
        temperature: 0.7,
        num_return_sequences: 1
      }
    };

    const data = await callHuggingFace(url, payload, parseInt(process.env.AI_MAX_RETRIES) || 3);
    
    // T5 model returns [{ translation_text: "..." }] or [{ generated_text: "..." }] or similar
    const rewrittenText = data[0]?.translation_text || data[0]?.generated_text || mockRewriteFallback(cleanText, toneClean);

    const result = {
      success: true,
      rewrittenText,
      originalText: cleanText,
      tone: toneClean,
      originalLength: cleanText.length,
      rewrittenLength: rewrittenText.length,
      model: 't5-base',
      processingTime: parseFloat(((Date.now() - startTime) / 1000).toFixed(2))
    };

    cache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL });
    updateMetrics(true, result.processingTime);
    return result;

  } catch (error) {
    console.error('[AI Service] Rewriting API failed, serving fallback:', error.message || error);
    
    const rewrittenText = mockRewriteFallback(cleanText, toneClean);
    const result = {
      success: true,
      rewrittenText,
      originalText: cleanText,
      tone: toneClean,
      fallback: true,
      reason: 'huggingface_api_unavailable',
      originalLength: cleanText.length,
      rewrittenLength: rewrittenText.length,
      processingTime: parseFloat(((Date.now() - startTime) / 1000).toFixed(2))
    };

    updateMetrics(false, result.processingTime);
    return result;
  }
}
