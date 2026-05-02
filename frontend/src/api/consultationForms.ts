import { http } from './axios';
import type { ConsultationForm } from './types';

export const consultationFormsApi = {
  async submit(data: Omit<ConsultationForm, 'id' | 'createdAt' | 'updatedAt'>): Promise<ConsultationForm> {
    const res = await http.post<{ form: ConsultationForm }>('/consultation-forms', data);
    return res.data.form;
  },
  async getByPhone(phone: string): Promise<ConsultationForm | null> {
    try {
      const res = await http.get<{ form: ConsultationForm }>(`/consultation-forms/${phone}`);
      return res.data.form;
    } catch (err) {
      if ((err as { response?: { status?: number } }).response?.status === 404) return null;
      throw err;
    }
  },
  async getMine(phone: string): Promise<ConsultationForm | null> {
    try {
      const res = await http.get<{ form: ConsultationForm }>(`/consultation-forms/mine/${phone}`);
      return res.data.form;
    } catch (err) {
      if ((err as { response?: { status?: number } }).response?.status === 404) return null;
      throw err;
    }
  },
};
