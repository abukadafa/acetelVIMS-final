import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
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
    // Check if it's an authentication error
    if (err.response?.status === 401 && !err.config._retry && !window.location.pathname.includes('/login')) {
      // Don't redirect if we're already on login or trying to login
      window.location.href = '/login?expired=true';
    }
    return Promise.reject(err);
  }
);

export default api;
