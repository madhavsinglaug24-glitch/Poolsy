// api.js - Centralized API Helper for Poolsy

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

function getAuthHeaders(isFormData = false) {
  const token = localStorage.getItem('token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

export async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const isFormData = options.body instanceof FormData;
  
  const fetchOptions = {
    ...options,
    headers: {
      ...getAuthHeaders(isFormData),
      ...options.headers,
    },
  };

  let response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (err) {
    throw new Error('Unable to connect to Poolsy. Please check your connection and try again.');
  }

  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (endpoint === '/api/auth/login') {
      throw new Error('Invalid email or password.');
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth-session-expired'));
    }
    throw new Error('Session expired. Please log in again.');
  }

  if (response.status === 403) {
    throw new Error('You do not have permission to perform this action.');
  }

  if (response.status === 404) {
    throw new Error('The requested resource was not found.');
  }

  if (response.status >= 500) {
    throw new Error('Something went wrong on the server. Please try again.');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || data.message || 'An API error occurred. Please try again.';
    throw new Error(errorMsg);
  }

  return data;
}
