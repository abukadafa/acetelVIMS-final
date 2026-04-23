import axios from 'axios';

// In production, API calls go to the same origin (served by Render backend).
// In development, Vite proxies /api to localhost:5000.
// VITE_API_URL can override for custom deployments.
let API_BASE = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;

// Ensure baseURL always ends with a slash (required by Axios for correct path joining)
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

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config._retry && !window.location.pathname.includes('/login')) {
      window.location.href = '/login?expired=true';
    }
    return Promise.reject(err);
  }
);

export default api;
