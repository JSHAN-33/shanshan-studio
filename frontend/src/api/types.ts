export type BookingStatus = '待確認' | '已確認' | '已完成' | '已取消';
export type PayMethod = '現金' | '轉帳' | '儲值金';
export type ServiceCat = 'women' | 'men' | 'eyelash' | 'products' | 'all';

export interface Booking {
  id: string;
  name: string;
  phone: string;
  bday?: string | null;
  lineUserId?: string | null;
  date: string;
  time: string;
  items: string;
  total: number;
  status: BookingStatus;
  remarks?: string | null;
  payMethod?: PayMethod | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  id: string;
  phone: string;
  name: string;
  bday?: string | null;
  gender?: '男' | '女' | null;
  note?: string | null;
  wallet: number;
  lineUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  bookingCount?: number;
}

export interface Service {
  id: string;
  name: string;
  nameEn?: string | null;
  cat: ServiceCat;
  price: number;
  oldPrice?: number | null;
  duration?: number | null;
  note?: string | null;
  isCombo: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface Cost {
  id: string;
  cat: '耗材' | '店租' | '水電' | '行銷' | '薪資' | '其他';
  desc?: string | null;
  amount: number;
  date: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  minQty: number;
  createdAt: string;
  updatedAt: string;
}

export interface BlockedSlot {
  id: string;
  date: string;
  time: string;
}

export interface AvailableSlot {
  time: string;
  available: boolean;
  reason?: 'booked' | 'blocked';
}

export interface FinanceSummary {
  today: { revenue: number; cost: number; net: number; bookings: number };
  month: { revenue: number; cost: number; net: number; bookings: number };
  nextMonthEstimate: { bookings: number; revenue: number };
}
