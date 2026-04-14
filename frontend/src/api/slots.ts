import { http } from './axios';
import type { BlockedSlot } from './types';

export const slotsApi = {
  async getConfig(): Promise<string[]> {
    const res = await http.get<{ slots: string[] }>('/slots/config');
    return res.data.slots;
  },
  async updateConfig(slots: string[]): Promise<string[]> {
    const res = await http.put<{ slots: string[] }>('/slots/config', { slots });
    return res.data.slots;
  },
  async listBlocked(month?: string): Promise<BlockedSlot[]> {
    const res = await http.get<{ blocked: BlockedSlot[] }>('/slots/blocked', {
      params: month ? { month } : {},
    });
    return res.data.blocked;
  },
  async block(date: string, time: string): Promise<void> {
    await http.post('/slots/blocked', { date, time });
  },
  async unblock(date: string, time: string): Promise<void> {
    await http.delete('/slots/blocked', { data: { date, time } });
  },
};
