const API_BASE = 'http://localhost:4000/api';

async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  // Set up default headers and options
  const defaultHeaders = {
    'Content-Type': 'application/json'
  };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    },
    credentials: 'include' // Crucial: forces sending/receiving cookies for session storage
  };

  // Convert body to string if it's an object
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Package standard error payload
      return {
        success: false,
        status: response.status,
        error: data.error || { message: 'An unexpected request error occurred.' },
        blocked: data.blocked || false,
        reason: data.reason || null,
        usage: data.usage || null,
        upgradeRequired: data.upgradeRequired || false,
        plan: data.plan || null
      };
    }

    return {
      success: true,
      status: response.status,
      ...data
    };
  } catch (error) {
    console.error(`[API client] Error calling ${endpoint}:`, error);
    return {
      success: false,
      status: 500,
      error: { message: 'Connection refused. Ensure the backend server is running.' }
    };
  }
}

// Export individual API endpoints
export const authAPI = {
  signup: (email, password, name) => apiCall('/auth/signup', { method: 'POST', body: { email, password, name } }),
  login: (email, password) => apiCall('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => apiCall('/auth/logout', { method: 'POST' }),
  me: () => apiCall('/auth/me', { method: 'GET' })
};

export const processAPI = {
  processText: (text, operation, tone) => apiCall('/process', { method: 'POST', body: { text, operation, tone } })
};

export const usageAPI = {
  getUsage: (limit = 10, offset = 0) => apiCall(`/usage?limit=${limit}&offset=${offset}`, { method: 'GET' })
};

export const billingAPI = {
  upgrade: (plan = 'pro') => apiCall('/billing/upgrade', { method: 'POST', body: { plan } }),
  downgrade: () => apiCall('/billing/downgrade', { method: 'POST' }),
  settle: () => apiCall('/billing/settle', { method: 'POST' })
};
