import axios from 'axios';

const API_BASE = (import.meta.env.VITE_API_URL as string) || 'https://acetel-backend.onrender.com/api/';

// In-memory token store — used as Authorization header fallback when
// cross-origin cookies are blocked (Safari ITP, some proxy configs)
let memoryToken: string | null = null;

export function setMemoryToken(token: string | null) {
  memoryToken = token;
}

export function getMemoryToken() {
  return memoryToken;
}

const api = axios.create({
  baseURL: API_BASE.endsWith('/') ? API_BASE : API_BASE + '/',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// Attach token from memory if available (cookie fallback)
api.interceptors.request.use((config) => {
  // Strip leading slash so it doesn't override the baseURL path
  if (config.url?.startsWith('/')) {
    config.url = config.url.substring(1);
  }
  // Use in-memory token as Authorization header if we have one
  if (memoryToken) {
    config.headers = config.headers || {};
    config.headers['Authorization'] = `Bearer ${memoryToken}`;
  }
  return config;
});

// NOTE: No 401 redirect here — AuthContext handles session expiry
export default api;
