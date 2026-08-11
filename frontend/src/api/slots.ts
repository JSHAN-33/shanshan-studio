import { http } from './axios';
import type { BlockedSlot, BookingMonthStatus } from './types';

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
  async listForcedOpen(month?: string): Promise<BlockedSlot[]> {
    const res = await http.get<{ forcedOpen: BlockedSlot[] }>('/slots/forced-open', {
      params: month ? { month } : {},
    });
    return res.data.forcedOpen;
  },
  async forceOpen(date: string, time: string): Promise<void> {
    await http.post('/slots/forced-open', { date, time });
  },
  async unforceOpen(date: string, time: string): Promise<void> {
    await http.delete('/slots/forced-open', { data: { date, time } });
  },
  async getBookingMonths(): Promise<BookingMonthStatus[]> {
    const res = await http.get<{ months: BookingMonthStatus[] }>('/slots/booking-months');
    return res.data.months;
  },
  async setBookingMonth(yearMonth: string, isOpen: boolean): Promise<void> {
    await http.put(`/slots/booking-months/${yearMonth}`, { isOpen });
  },
  async resetBookingMonth(yearMonth: string): Promise<void> {
    await http.delete(`/slots/booking-months/${yearMonth}`);
  },
};
