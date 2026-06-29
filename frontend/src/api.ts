import axios from 'axios';

// Em produção (Vercel), defina VITE_API_URL nas Environment Variables
// apontando para a URL do backend no Render:
// Ex: VITE_API_URL=https://onboarding-api.onrender.com
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
