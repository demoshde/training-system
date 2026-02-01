import axios from 'axios';

// Worker API instance
export const workerApi = axios.create({
  baseURL: '/api/worker'
});

workerApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('workerToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

workerApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('workerToken');
      localStorage.removeItem('worker');
      window.location.replace('/login');
    }
    return Promise.reject(error);
  }
);

// Admin API instance
export const adminApi = axios.create({
  baseURL: '/api/admin'
});

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('admin');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

// Auth API (no interceptors needed)
export const authApi = axios.create({
  baseURL: '/api/auth'
});

// Default export for general API calls
const api = axios.create({
  baseURL: '/api'
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('workerToken') || localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
