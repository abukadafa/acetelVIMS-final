import axios from 'axios';

const API_BASE = (import.meta.env.VITE_API_URL as string) || 'https://acetel-backend.onrender.com/api/';

const api = axios.create({
  baseURL: API_BASE.endsWith('/') ? API_BASE : API_BASE + '/',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// Final Production Architecture: Use sessionStorage for token persistence
// across page reloads and as a fallback for cross-origin cookie blocking.
api.interceptors.request.use((config) => {
  // Strip leading slash from endpoint URL to avoid overriding baseURL path
  if (config.url?.startsWith('/')) {
    config.url = config.url.substring(1);
  }

  // Inject Bearer token from sessionStorage
  const token = sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Error interceptor removed: AuthContext handles session expiry globally
export default api;
