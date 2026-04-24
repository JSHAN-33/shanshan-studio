export type BookingStatus = '待付訂金' | '待確認' | '已確認' | '已完成' | '已取消';
export type DepositStatus = '待付訂金' | '已付訂金' | '不退還';
export type PayMethod = '現金' | '轉帳' | '儲值金' | '空檔費';
export type ServiceCat = 'women' | 'men' | 'eyelash' | 'products' | 'all';

export interface Booking {
  id: string;
  name: string;
  phone: string;
  bday?: string | null;
  lineUserId?: string | null;
  date: string;
  time: string;
  duration?: number | null;
  items: string;
  total: number;
  status: BookingStatus;
  remarks?: string | null;
  payMethod?: PayMethod | null;
  walletUsed?: number | null;
  paidAt?: string | null;
  depositAmount?: number | null;
  depositStatus?: DepositStatus | null;
  createdAt: string;
  updatedAt: string;
}

export interface DepositSetting {
  enabled: boolean;
  amount: number;
  bankInfo: string;
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
  pictureUrl?: string | null;
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

export type InventoryCat = 'product' | 'consumable';

export interface InventoryItem {
  id: string;
  name: string;
  cat: InventoryCat;
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

export interface ServiceHistory {
  id: string;
  phone: string;
  date: string;
  items: string;
  total: number;
  remarks?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PayMethodLabel = '現金' | '轉帳' | '儲值金' | '空檔費';

export interface PayMethodBookingEntry {
  id: string;
  name: string;
  phone: string;
  items: string;
  total: number;
  date: string;
  time: string;
  paidAt: string | null;
}

export type PayMethodBreakdown = Record<
  PayMethodLabel,
  { count: number; total: number; bookings: PayMethodBookingEntry[] }
>;

export interface YearMonthEntry {
  month: string; // YYYY-MM
  revenue: number;
  bookings: number;
}

export interface FinanceSummary {
  today: { revenue: number; cost: number; net: number; bookings: number; byPayMethod: PayMethodBreakdown };
  month: { revenue: number; cost: number; net: number; bookings: number; byPayMethod: PayMethodBreakdown };
  year: { year: number; revenue: number; bookings: number; byMonth: YearMonthEntry[] };
  nextMonthEstimate: { bookings: number; revenue: number };
}

export interface YearSummary {
  year: number;
  revenue: number;
  bookings: number;
  byMonth: YearMonthEntry[];
  availableYears: number[];
}

export interface MonthSummary {
  month: string; // YYYY-MM
  revenue: number;
  cost: number;
  net: number;
  bookings: number;
  byPayMethod: PayMethodBreakdown;
}

export interface AnalyticsSummary {
  monthlyBookings: number;
  popularTimeSlots: Array<{ time: string; count: number }>;
  popularServices: Array<{ name: string; count: number }>;
}
