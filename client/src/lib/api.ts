import axios from 'axios';

// Vite bakes VITE_* vars at build time. Ensure VITE_API_URL is set in the
// Render frontend service env vars ending with /api/
const API_BASE = (import.meta.env.VITE_API_URL as string) || 'https://acetel-backend.onrender.com/api/';

// Normalise: must end with /
const normalisedBase = API_BASE.endsWith('/') ? API_BASE : API_BASE + '/';

const api = axios.create({
  baseURL: normalisedBase,
  withCredentials: true,   // httpOnly cookie is the auth mechanism
  timeout: 30000,          // 30 s — accommodates Render free-tier cold starts
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
/** Wake Render / cold backend before authenticated API calls */
export async function warmUpBackend(): Promise<void> {
  try {
    await axios.get(`${normalisedBase}health`, { timeout: 45000 });
  } catch {
    /* silent — analytics/login will retry */
  }
}

/**
 * Kept for API compatibility — no-op now that auth is cookie-based.
 * The server sets httpOnly cookies on login; the browser sends them
 * automatically on every credentialed request. Storing tokens in
 * sessionStorage/localStorage would expose them to XSS attacks.
 */
export function setAuthToken(_token: string | null) {
  // Intentionally empty: auth is via httpOnly cookie, not JS-accessible token.
}

api.interceptors.request.use((config) => {
  // Strip leading slash from endpoint URL to avoid overriding baseURL path
  if (config.url?.startsWith('/')) {
    config.url = config.url.substring(1);
  }
  return config;
});

// Auto-logout on 401 (session expired / cookie invalid).
// Skip for the login and profile endpoints themselves to avoid redirect loops.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const url = error.config?.url ?? '';
    const isAuthEndpoint =
      url.includes('auth/login') ||
      url.includes('auth/profile') ||
      url.includes('auth/logout');

    // If we got a blob response (e.g. export) but server returned an error,
    // parse the blob as JSON so callers can read error.response.data.error
    if (
      error.response &&
      error.response.data instanceof Blob &&
      error.response.data.type.includes('application/json')
    ) {
      try {
        const text = await error.response.data.text();
        error.response.data = JSON.parse(text);
      } catch {
        // leave as-is if parsing fails
      }
    }

    if (error.response?.status === 401 && !isAuthEndpoint) {
      // Dispatch a global event; AuthProvider listens and calls logout() which
      // clears state and redirects to /login, avoiding a hard page reload.
      window.dispatchEvent(new CustomEvent('acetel:session-expired'));
    }
    return Promise.reject(error);
  }
);

export default api;
