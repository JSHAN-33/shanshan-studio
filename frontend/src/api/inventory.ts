import { http } from './axios';
import type { InventoryItem } from './types';

export const inventoryApi = {
  async list(): Promise<{ items: InventoryItem[]; lowStock: InventoryItem[] }> {
    const res = await http.get<{ items: InventoryItem[]; lowStock: InventoryItem[] }>('/inventory');
    return res.data;
  },
  async create(data: { name: string; qty?: number; unit?: string; minQty?: number }): Promise<InventoryItem> {
    const res = await http.post<{ item: InventoryItem }>('/inventory', data);
    return res.data.item;
  },
  async update(id: string, data: Partial<InventoryItem>): Promise<InventoryItem> {
    const res = await http.patch<{ item: InventoryItem }>(`/inventory/${id}`, data);
    return res.data.item;
  },
  async remove(id: string): Promise<void> {
    await http.delete(`/inventory/${id}`);
  },
};
