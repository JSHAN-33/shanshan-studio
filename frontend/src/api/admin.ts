import { http } from './axios';

export const adminApi = {
  async login(token: string): Promise<boolean> {
    try {
      await http.post('/admin/login', { token });
      return true;
    } catch {
      return false;
    }
  },
};
