import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const baseURL = process.env.FLEXPRICE_BASE_URL || 'http://localhost:8080';
const apiKey = process.env.FLEXPRICE_API_KEY || 'sk_local_flexprice_test_key';

const flexpriceClient = axios.create({
  baseURL: `${baseURL}/v1`,
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'x-environment-id': '00000000-0000-0000-0000-000000000000'
  }
});

// Request interceptor for logging/debugging
flexpriceClient.interceptors.request.use(
  (config) => {
    // Log outbound requests in development if needed
    console.debug(`[Flexprice API Request] ${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error normalization
flexpriceClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    const errorData = {
      message: 'Unknown Flexprice API Error',
      status: error.response?.status || 500,
      code: 'FLEXPRICE_ERROR',
      details: null
    };

    if (error.response) {
      // Server responded with an error status code
      errorData.message = error.response.data?.error || error.response.data?.message || `HTTP error ${error.response.status}`;
      errorData.details = error.response.data;
      console.error(`[Flexprice API Error Response] Status ${errorData.status}:`, errorData.message);
    } else if (error.request) {
      // Request was made but no response was received
      errorData.message = 'No response received from Flexprice server. Check if the server is running.';
      errorData.code = 'NETWORK_ERROR';
      console.error('[Flexprice Network Error] No response received:', error.message);
    } else {
      // Something happened in setting up the request
      errorData.message = error.message;
      console.error('[Flexprice Client Error] Request setup failed:', error.message);
    }

    return Promise.reject(errorData);
  }
);

export default flexpriceClient;
