import { http } from './axios';
import type { AvailableSlot, Booking, BookingStatus, PayMethod } from './types';

export const bookingsApi = {
  async listByPhone(phone: string): Promise<Booking[]> {
    const res = await http.get<{ bookings: Booking[] }>('/bookings', { params: { phone } });
    return res.data.bookings;
  },
  async listAll(params: { date?: string; month?: string; status?: BookingStatus } = {}): Promise<Booking[]> {
    const res = await http.get<{ bookings: Booking[] }>('/bookings', { params });
    return res.data.bookings;
  },
  async availableSlots(date: string, duration?: number): Promise<AvailableSlot[]> {
    const params: Record<string, string | number> = { date };
    if (duration) params.duration = duration;
    const res = await http.get<{ date: string; slots: AvailableSlot[] }>(
      '/bookings/available-slots',
      { params }
    );
    return res.data.slots;
  },
  async create(data: {
    name: string;
    phone: string;
    bday?: string | null;
    lineUserId?: string | null;
    date: string;
    time: string;
    items: string;
    total: number;
    remarks?: string | null;
  }): Promise<Booking> {
    const res = await http.post<{ booking: Booking }>('/bookings', data);
    return res.data.booking;
  },
  async update(
    id: string,
    data: Partial<{
      name: string;
      phone: string;
      date: string;
      time: string;
      items: string;
      total: number;
      status: BookingStatus;
      remarks: string | null;
      payMethod: PayMethod | null;
      paidAt: string | null;
    }>
  ): Promise<Booking> {
    const res = await http.patch<{ booking: Booking }>(`/bookings/${id}`, data);
    return res.data.booking;
  },
  async remove(id: string): Promise<void> {
    await http.delete(`/bookings/${id}`);
  },
  async cancel(id: string): Promise<Booking> {
    return this.update(id, { status: '已取消' });
  },
  async cancelByCustomer(id: string, phone: string): Promise<Booking> {
    const res = await http.post<{ booking: Booking }>(`/bookings/${id}/cancel`, { phone });
    return res.data.booking;
  },
};
