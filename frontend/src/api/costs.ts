import { http } from './axios';
import type { Cost } from './types';

export const costsApi = {
  async list(params: { month?: string; cat?: Cost['cat'] } = {}): Promise<Cost[]> {
    const res = await http.get<{ costs: Cost[] }>('/costs', { params });
    return res.data.costs;
  },
  async create(data: { cat: Cost['cat']; desc?: string; amount: number; date: string }): Promise<Cost> {
    const res = await http.post<{ cost: Cost }>('/costs', data);
    return res.data.cost;
  },
  async update(id: string, data: Partial<{ cat: Cost['cat']; desc: string; amount: number; date: string }>): Promise<Cost> {
    const res = await http.patch<{ cost: Cost }>(`/costs/${id}`, data);
    return res.data.cost;
  },
  async remove(id: string): Promise<void> {
    await http.delete(`/costs/${id}`);
  },
};
