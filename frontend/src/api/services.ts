import { http } from './axios';
import type { Service } from './types';

export const servicesApi = {
  async list(includeInactive = false): Promise<Service[]> {
    const res = await http.get<{ services: Service[] }>('/services', {
      params: includeInactive ? { includeInactive: 'true' } : {},
    });
    return res.data.services;
  },
  async create(data: Partial<Service> & { id: string; name: string; cat: Service['cat']; price: number }): Promise<Service> {
    const res = await http.post<{ service: Service }>('/services', data);
    return res.data.service;
  },
  async update(id: string, data: Partial<Service>): Promise<Service> {
    const res = await http.patch<{ service: Service }>(`/services/${id}`, data);
    return res.data.service;
  },
  async remove(id: string): Promise<void> {
    await http.delete(`/services/${id}`);
  },
};
