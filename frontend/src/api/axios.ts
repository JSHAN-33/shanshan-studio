import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
});

http.interceptors.request.use((config) => {
  const auth = useAuthStore();
  if (auth.adminToken) {
    config.headers['X-Admin-Token'] = auth.adminToken;
  }
  if (auth.profile?.userId) {
    config.headers['X-Line-User-Id'] = auth.profile.userId;
  }
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      const auth = useAuthStore();
      auth.clearAdmin();
    }
    return Promise.reject(err);
  }
);
