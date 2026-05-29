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
 * Hybrid Auth: Uses httpOnly cookies by default, but stores a fallback token
 * in localStorage for cross-domain deployments (e.g. Render) where modern
 * browsers (Safari ITP, Brave) block third-party cookies.
 */
export function setAuthToken(token: string | null, refresh: string | null = null) {
  if (token) {
    localStorage.setItem('acetel_token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    localStorage.removeItem('acetel_token');
    delete api.defaults.headers.common['Authorization'];
  }
  
  if (refresh) {
    localStorage.setItem('acetel_refresh_token', refresh);
  } else if (token === null) {
    localStorage.removeItem('acetel_refresh_token');
  }
}

// Restore token on load
const storedToken = localStorage.getItem('acetel_token');
if (storedToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
}

api.interceptors.request.use((config) => {
  // Strip leading slash from endpoint URL to avoid overriding baseURL path
  if (config.url?.startsWith('/')) {
    config.url = config.url.substring(1);
  }
  return config;
});

let isRefreshing = false;
let failedQueue: { resolve: (value?: unknown) => void, reject: (reason?: any) => void }[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Auto-logout on 401 (session expired / cookie invalid), but attempt refresh first.
// Skip for the login, profile, and refresh endpoints themselves to avoid redirect loops.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const url = originalRequest?.url ?? '';
    const isAuthEndpoint =
      url.includes('auth/login') ||
      url.includes('auth/profile') ||
      url.includes('auth/logout') ||
      url.includes('auth/refresh');

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

    if (error.response?.status === 401 && !isAuthEndpoint && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const storedRefresh = localStorage.getItem('acetel_refresh_token');
        const res = await api.post('auth/refresh', { refreshToken: storedRefresh });
        const newToken = res.data.accessToken;
        const newRefresh = res.data.refreshToken;
        
        if (newToken) {
          setAuthToken(newToken, newRefresh);
        }

        isRefreshing = false;
        processQueue(null, 'refreshed');
        
        if (newToken && originalRequest.headers) {
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError, null);
        window.dispatchEvent(new CustomEvent('acetel:session-expired'));
        return Promise.reject(refreshError);
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
