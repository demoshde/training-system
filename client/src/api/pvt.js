import axios from 'axios';

export const pvtApi = axios.create({ baseURL: '/api/pvt' });

pvtApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('pvtToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

pvtApi.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('pvtToken');
      localStorage.removeItem('pvtUser');
      window.location.href = '/pvt';
    }
    return Promise.reject(error);
  }
);
