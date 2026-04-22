import { http } from './axios';
import type { AvailableSlot, Booking, BookingStatus, DepositStatus, PayMethod } from './types';

export const bookingsApi = {
  async listByPhone(phone: string): Promise<Booking[]> {
    const res = await http.get<{ bookings: Booking[] }>('/bookings', { params: { phone } });
    return res.data.bookings;
  },
  async listAll(
    params: {
      date?: string;
      month?: string;
      status?: BookingStatus;
      paid?: 'true' | 'false';
      paidMonth?: string;
    } = {}
  ): Promise<Booking[]> {
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
  async bulkAvailableSlots(
    startDate: string,
    endDate: string,
    duration?: number
  ): Promise<Record<string, string[]>> {
    const params: Record<string, string | number> = { startDate, endDate };
    if (duration) params.duration = duration;
    const res = await http.get<{ slotsByDate: Record<string, string[]> }>(
      '/bookings/available-slots/bulk',
      { params }
    );
    return res.data.slotsByDate;
  },
  async create(data: {
    name: string;
    phone: string;
    bday?: string | null;
    lineUserId?: string | null;
    date: string;
    time: string;
    duration?: number | null;
    items: string;
    total: number;
    remarks?: string | null;
    inLiff?: boolean;
  }): Promise<Booking> {
    const res = await http.post<{ booking: Booking }>('/bookings', data);
    return res.data.booking;
  },
  async adminCreate(data: {
    name: string;
    phone: string;
    bday?: string | null;
    lineUserId?: string | null;
    date: string;
    time: string;
    duration?: number | null;
    items: string;
    total: number;
    remarks?: string | null;
  }): Promise<Booking> {
    const res = await http.post<{ booking: Booking }>('/bookings/admin', data);
    return res.data.booking;
  },
  async update(
    id: string,
    data: Partial<{
      name: string;
      phone: string;
      date: string;
      time: string;
      duration: number | null;
      items: string;
      total: number;
      status: BookingStatus;
      remarks: string | null;
      payMethod: PayMethod | null;
      walletUsed: number | null;
      paidAt: string | null;
      depositStatus: DepositStatus | null;
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
