import axios from 'axios';

// Worker-side PVT calls — uses existing worker token
export const pvtApi = axios.create({ baseURL: '/api/pvt' });
pvtApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('workerToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Guest PVT calls — no authentication (SAP number only)
export const pvtGuestApi = axios.create({ baseURL: '/api/pvt' });

// Admin-side PVT calls — uses existing admin token
export const pvtAdminApi = axios.create({ baseURL: '/api/pvt' });
pvtAdminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
