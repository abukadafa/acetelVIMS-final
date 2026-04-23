import axios from 'axios';

let API_BASE = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;

// Important: Axios baseURL with a path segment (like /api) MUST end with a slash
// and request URLs must NOT start with a slash to concatenate correctly.
if (!API_BASE.endsWith('/')) {
  API_BASE += '/';
}

const api = axios.create({ 
  baseURL: API_BASE, 
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  }
});

// Interceptor to handle leading slashes in URLs which overwrite the baseURL path in Axios
api.interceptors.request.use((config) => {
  if (config.url?.startsWith('/')) {
    config.url = config.url.substring(1);
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Check if it's an authentication error
    if (err.response?.status === 401 && !err.config._retry && !window.location.pathname.includes('/login')) {
      // Don't redirect if we're already on login or trying to login
      window.location.href = '/login?expired=true';
    }
    return Promise.reject(err);
  }
);

export default api;
