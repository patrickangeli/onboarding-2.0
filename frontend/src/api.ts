import axios from 'axios';

// Em Codespaces, defina VITE_API_URL no .env com a URL pública da porta 3000
// Ex: VITE_API_URL=https://seu-codespace-3000.app.github.dev
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
