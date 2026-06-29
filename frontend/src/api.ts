import axios from 'axios';

const BASE = ((import.meta as any).env?.VITE_API_URL ?? '') + '/api';

const api = axios.create({ baseURL: BASE });

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
