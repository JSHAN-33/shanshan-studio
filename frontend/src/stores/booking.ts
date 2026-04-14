import { defineStore } from 'pinia';
import type { Service } from '@/api/types';

interface BookingState {
  cart: Service[];
  date: string | null;
  time: string | null;
  remarks: string;
  isFirstTime: boolean;
}

export const useBookingStore = defineStore('booking', {
  state: (): BookingState => ({
    cart: [],
    date: null,
    time: null,
    remarks: '',
    isFirstTime: false,
  }),
  getters: {
    subtotal: (s) => s.cart.reduce((sum, it) => sum + it.price, 0),
    hasCombo: (s) => s.cart.some((it) => it.isCombo),
    hasNonCombo: (s) => s.cart.some((it) => !it.isCombo),
    discount(): number {
      if (!this.isFirstTime) return 0;
      // 只選套餐沒有加購其他項目 → 不適用
      if (this.hasCombo && !this.hasNonCombo) return 0;
      return 200;
    },
    total(): number { return Math.max(0, this.subtotal - this.discount); },
    totalDuration: (s) => s.cart.reduce((sum, it) => sum + (it.duration ?? 0), 0),
    itemsLabel: (s) => s.cart.map((it) => it.name).join('、'),
    count: (s) => s.cart.length,
  },
  actions: {
    toggle(service: Service) {
      const idx = this.cart.findIndex((s) => s.id === service.id);
      if (idx >= 0) this.cart.splice(idx, 1);
      else this.cart.push(service);
    },
    has(serviceId: string) {
      return this.cart.some((s) => s.id === serviceId);
    },
    reset() {
      this.cart = [];
      this.date = null;
      this.time = null;
      this.remarks = '';
      this.isFirstTime = false;
    },
  },
});
