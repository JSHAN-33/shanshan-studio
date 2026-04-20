import { http } from './axios';
import type { ServiceHistory } from './types';

export const serviceHistoryApi = {
  async listByPhone(phone: string): Promise<ServiceHistory[]> {
    const res = await http.get<{ items: ServiceHistory[] }>('/service-history', {
      params: { phone },
    });
    return res.data.items;
  },
  async create(data: {
    phone: string;
    date: string;
    items: string;
    total: number;
    remarks?: string | null;
  }): Promise<ServiceHistory> {
    const res = await http.post<{ item: ServiceHistory }>('/service-history', data);
    return res.data.item;
  },
  async update(
    id: string,
    data: Partial<{ date: string; items: string; total: number; remarks: string | null }>
  ): Promise<ServiceHistory> {
    const res = await http.patch<{ item: ServiceHistory }>(`/service-history/${id}`, data);
    return res.data.item;
  },
  async remove(id: string): Promise<void> {
    await http.delete(`/service-history/${id}`);
  },
};
