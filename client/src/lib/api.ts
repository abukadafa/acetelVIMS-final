import axios from 'axios';

// Vite bakes VITE_* vars at build time. Ensure VITE_API_URL is set in the
// Render frontend service env vars ending with /api/
const API_BASE = (import.meta.env.VITE_API_URL as string) || 'https://acetel-backend.onrender.com/api/';

// Normalise: must end with /
const normalisedBase = API_BASE.endsWith('/') ? API_BASE : API_BASE + '/';

const api = axios.create({
  baseURL: normalisedBase,
  withCredentials: true,
  timeout: 30000, // 30 s — accommodates Render free-tier cold starts
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

/**
 * Pings the health endpoint to wake the backend before the user logs in.
 * On Render free tier the server sleeps after 15 min of inactivity; this
 * fires immediately on app load so the warm-up happens in the background.
 */
export function warmUpBackend() {
  axios.get(`${normalisedBase}health`).catch(() => {/* silent — just warming up */});
}

/**
 * Sets the Bearer token on the shared axios instance immediately,
 * so all in-flight requests after login pick it up without waiting
 * for the interceptor to read from sessionStorage.
 * Call this right after receiving the accessToken from the login response.
 */
export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    sessionStorage.setItem('token', token);
  } else {
    delete api.defaults.headers.common['Authorization'];
    sessionStorage.removeItem('token');
  }
}

// On app boot: rehydrate the Authorization header from sessionStorage
// so page refreshes do not require a new login.
const storedToken = sessionStorage.getItem('token');
if (storedToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
}

api.interceptors.request.use((config) => {
  // Strip leading slash from endpoint URL to avoid overriding baseURL path
  if (config.url?.startsWith('/')) {
    config.url = config.url.substring(1);
  }

  // Belt-and-suspenders: also read from sessionStorage in case the
  // instance default header was cleared (e.g. after a logout/login cycle).
  if (!config.headers['Authorization']) {
    const token = sessionStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return config;
});

export default api;
