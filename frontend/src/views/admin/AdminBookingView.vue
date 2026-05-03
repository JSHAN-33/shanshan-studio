<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useToast } from '@/composables/useToast';
import { usePullRefresh } from '@/composables/usePullRefresh';
import SharedCalendar from '@/components/SharedCalendar.vue';
import { bookingsApi } from '@/api/bookings';
import { financeApi } from '@/api/finance';
import { slotsApi } from '@/api/slots';
import { servicesApi } from '@/api/services';
import { membersApi } from '@/api/members';
import { settingsApi } from '@/api/settings';
import type { Booking, BookingStatus, DepositSetting, FinanceSummary, BlockedSlot, Service, ServiceCat, Member } from '@/api/types';

const selectedDate = ref<string | null>(new Date().toISOString().slice(0, 10));
const month = ref<string>(new Date().toISOString().slice(0, 7));
const monthBookings = ref<Booking[]>([]);
const summary = ref<FinanceSummary | null>(null);
const loading = ref(false);

// --- 時段管理 ---
const showSlotModal = ref(false);
const slotDate = ref('');
const allSlots = ref<string[]>([]);
const blockedSlots = ref<BlockedSlot[]>([]);
const slotLoading = ref(false);

// 生成 30 分鐘間隔的時段 (10:00 ~ 21:30)
const defaultSlots = (() => {
  const slots: string[] = [];
  for (let h = 10; h <= 21; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    if (h < 22) slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  return slots;
})();

function expandBookedTimes(bookings: Booking[], date: string): Set<string> {
  const set = new Set<string>();
  for (const b of bookings) {
    if (b.date !== date || b.status === '已取消') continue;
    set.add(b.time);
    const dur = b.duration ?? 30;
    if (dur > 30) {
      const [h, m] = b.time.split(':').map(Number);
      const startMin = h * 60 + m;
      const slotsNeeded = Math.ceil(dur / 30);
      for (let i = 1; i < slotsNeeded; i++) {
        const min = startMin + i * 30;
        const t = `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
        set.add(t);
      }
    }
  }
  return set;
}

const bookedTimesForDate = computed(() => expandBookedTimes(monthBookings.value, slotDate.value));

const blockedTimesForDate = computed(() => {
  const set = new Set<string>();
  for (const bs of blockedSlots.value) {
    if (bs.date === slotDate.value) set.add(bs.time);
  }
  return set;
});

function getSlotStatus(time: string): 'booked' | 'blocked' | 'available' {
  if (bookedTimesForDate.value.has(time)) return 'booked';
  if (blockedTimesForDate.value.has(time)) return 'blocked';
  return 'available';
}

// 判斷某時段是否已過或太接近（需提前 2 小時預留）
// 當日時段在「現在 + 2 小時」以內都視為已過（例：14:30 時，14:30~16:30 全部自動關閉）
const BOOKING_BUFFER_MINUTES = 120;
function isTimePastForDate(date: string, time: string): boolean {
  const today = todayDateStr();
  if (date > today) return false;
  if (date < today) return true;
  const [h, m] = time.split(':').map(Number);
  const slotMinutes = h * 60 + m;
  const now = new Date();
  const bufferMinutes = now.getHours() * 60 + now.getMinutes() + BOOKING_BUFFER_MINUTES;
  return slotMinutes <= bufferMinutes;
}
function isSlotPast(time: string): boolean {
  return isTimePastForDate(slotDate.value, time);
}

async function openSlotModal(date: string) {
  slotDate.value = date;
  slotLoading.value = true;
  showSlotModal.value = true;
  try {
    const [config, blocked] = await Promise.all([
      slotsApi.getConfig(),
      slotsApi.listBlocked(month.value),
    ]);
    allSlots.value = config.length > 0 ? config : defaultSlots;
    blockedSlots.value = blocked;
  } finally {
    slotLoading.value = false;
  }
}

async function toggleSlot(time: string) {
  const status = getSlotStatus(time);
  if (status === 'booked') return; // 已預約的不能操作
  if (status === 'blocked') {
    await slotsApi.unblock(slotDate.value, time);
    blockedSlots.value = blockedSlots.value.filter(
      (bs) => !(bs.date === slotDate.value && bs.time === time)
    );
  } else {
    await slotsApi.block(slotDate.value, time);
    blockedSlots.value.push({ id: '', date: slotDate.value, time });
  }
}

const bulkSlotLoading = ref(false);

async function blockEntireDay() {
  const bookedCount = allSlots.value.filter((t) => getSlotStatus(t) === 'booked').length;
  const msg = bookedCount > 0
    ? `本日有 ${bookedCount} 筆已預約的時段不會被關閉，其他空檔時段將全部關閉。確認？`
    : '將關閉本日所有空檔時段，確認？';
  if (!window.confirm(msg)) return;

  bulkSlotLoading.value = true;
  try {
    const toBlock = allSlots.value.filter((t) => getSlotStatus(t) === 'available');
    await Promise.all(toBlock.map((t) => slotsApi.block(slotDate.value, t)));
    for (const t of toBlock) {
      blockedSlots.value.push({ id: '', date: slotDate.value, time: t });
    }
  } finally {
    bulkSlotLoading.value = false;
  }
}

async function unblockEntireDay() {
  const blockedForDay = allSlots.value.filter((t) => getSlotStatus(t) === 'blocked');
  if (!blockedForDay.length) return;
  if (!window.confirm(`將恢復本日 ${blockedForDay.length} 個已關閉時段為空檔，確認？`)) return;

  bulkSlotLoading.value = true;
  try {
    await Promise.all(blockedForDay.map((t) => slotsApi.unblock(slotDate.value, t)));
    blockedSlots.value = blockedSlots.value.filter((bs) => bs.date !== slotDate.value);
  } finally {
    bulkSlotLoading.value = false;
  }
}

// --- 預約 Modal ---
const showModal = ref(false);
const editing = ref<Booking | null>(null);
const form = ref({
  id: '',
  name: '',
  phone: '',
  date: '',
  time: '',
  items: '',
  total: 0,
  status: '待確認' as BookingStatus,
  remarks: '',
});

// --- 會員自動帶入 ---
const allMembers = ref<Member[]>([]);
const matchedMember = ref<Member | null>(null);

watch(() => form.value.phone, (phone) => {
  const p = phone.trim();
  if (!p) { matchedMember.value = null; return; }
  const found = allMembers.value.find((m) => m.phone === p);
  if (found) {
    matchedMember.value = found;
    if (!editing.value) {
      form.value.name = found.name;
    }
  } else {
    matchedMember.value = null;
  }
});

// --- 服務選擇 ---
const services = ref<Service[]>([]);
const selectedServices = ref<Set<string>>(new Set());
const serviceTab = ref<ServiceCat>('women');

const serviceTabs: Array<{ value: ServiceCat; label: string }> = [
  { value: 'women', label: '女生' },
  { value: 'men', label: '男士' },
  { value: 'eyelash', label: '睫毛' },
  { value: 'products', label: '產品' },
];

const filteredFormServices = computed(() =>
  services.value.filter((s) => s.cat === serviceTab.value)
);

const selectedTotal = computed(() => {
  let sum = 0;
  for (const s of services.value) {
    if (selectedServices.value.has(s.id)) sum += s.price;
  }
  return sum;
});

const selectedItemsLabel = computed(() => {
  return services.value
    .filter((s) => selectedServices.value.has(s.id))
    .map((s) => s.name)
    .join('、');
});

const selectedDuration = computed(() => {
  let sum = 0;
  for (const s of services.value) {
    if (selectedServices.value.has(s.id)) sum += s.duration ?? 0;
  }
  return sum;
});

function toggleFormService(id: string) {
  const set = new Set(selectedServices.value);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  selectedServices.value = set;
}

// --- 表單內日曆彈窗 ---
const showFormDatePicker = ref(false);
const formCalendarDate = ref<string | null>(null);

const formMarkedDates = computed(() => {
  const set = new Set<string>();
  for (const b of monthBookings.value) if (b.status !== '已取消') set.add(b.date);
  return Array.from(set);
});

const formBookedTimesForDate = computed(() => expandBookedTimes(monthBookings.value, formCalendarDate.value ?? ''));

const formBlockedTimesForDate = computed(() => {
  const set = new Set<string>();
  for (const bs of blockedSlots.value) {
    if (bs.date === formCalendarDate.value) set.add(bs.time);
  }
  return set;
});

function getFormSlotStatus(time: string): 'booked' | 'blocked' | 'available' {
  if (formBookedTimesForDate.value.has(time)) return 'booked';
  if (formBlockedTimesForDate.value.has(time)) return 'blocked';
  return 'available';
}

function openFormDatePicker() {
  formCalendarDate.value = form.value.date || null;
  showFormDatePicker.value = true;
}

async function onFormCalendarSelect(date: string) {
  formCalendarDate.value = date;
  try {
    const [config, blocked] = await Promise.all([
      slotsApi.getConfig(),
      slotsApi.listBlocked(date.slice(0, 7)),
    ]);
    allSlots.value = config.length > 0 ? config : defaultSlots;
    blockedSlots.value = blocked;
  } catch { /* ignore */ }
}

function selectFormSlot(time: string) {
  if (getFormSlotStatus(time) !== 'available') return;
  form.value.date = formCalendarDate.value ?? '';
  form.value.time = time;
  showFormDatePicker.value = false;
}

const toast = useToast();
const statuses: BookingStatus[] = ['待付訂金', '待確認', '已確認', '已完成', '已取消'];
const showStatusPicker = ref(false);

function selectStatus(s: BookingStatus) {
  form.value.status = s;
  showStatusPicker.value = false;
}
const statusClass: Record<BookingStatus, string> = {
  待付訂金: 'badge-deposit',
  待確認: 'badge-pending',
  已確認: 'badge-confirmed',
  已完成: 'badge-done',
  已取消: 'badge-cancelled',
};

const markedDates = computed(() => {
  const set = new Set<string>();
  for (const b of monthBookings.value) if (b.status !== '已取消') set.add(b.date);
  return Array.from(set);
});

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 整月整日都沒空檔（每個時段都被預約或關閉）的日期，加上所有過去的日期
const fullyUnavailableDates = computed(() => {
  const today = todayDateStr();
  const result: string[] = [];

  // 1. 所有過去的日期（當月）都反灰
  const [yStr, mStr] = month.value.split('-');
  const y = Number(yStr);
  const mon = Number(mStr);
  const lastDay = new Date(y, mon, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  for (let d = 1; d <= lastDay; d++) {
    const date = `${y}-${pad(mon)}-${pad(d)}`;
    if (date < today) result.push(date);
  }

  // 2. 當月整日都沒空檔的日子（考慮 duration 擴展已預約時段）
  if (allSlots.value.length) {
    const bookedByDate = new Map<string, Set<string>>();
    const uniqueDates = new Set<string>();
    for (const b of monthBookings.value) {
      if (b.status === '已取消') continue;
      uniqueDates.add(b.date);
    }
    for (const date of uniqueDates) {
      bookedByDate.set(date, expandBookedTimes(monthBookings.value, date));
    }
    const blockedByDate = new Map<string, Set<string>>();
    for (const bs of blockedSlots.value) {
      if (!blockedByDate.has(bs.date)) blockedByDate.set(bs.date, new Set());
      blockedByDate.get(bs.date)!.add(bs.time);
    }
    const candidates = new Set<string>([...bookedByDate.keys(), ...blockedByDate.keys(), today]);
    for (const date of candidates) {
      if (date < today) continue; // 已在 step 1 加過
      const unavailable = new Set<string>([
        ...(bookedByDate.get(date) ?? []),
        ...(blockedByDate.get(date) ?? []),
      ]);
      if (allSlots.value.every((t) => unavailable.has(t) || isTimePastForDate(date, t))) {
        result.push(date);
      }
    }
  }
  return result;
});

const dayBookings = computed(() =>
  selectedDate.value
    ? monthBookings.value.filter((b) => b.date === selectedDate.value).sort((a, b) => a.time.localeCompare(b.time))
    : []
);

async function loadMonth(m: string) {
  month.value = m;
  loading.value = true;
  try {
    const [list, sum, config, blocked] = await Promise.all([
      bookingsApi.listAll({ month: m }),
      financeApi.summary(),
      slotsApi.getConfig(),
      slotsApi.listBlocked(m),
    ]);
    monthBookings.value = list;
    summary.value = sum;
    allSlots.value = config.length > 0 ? config : defaultSlots;
    blockedSlots.value = blocked;
  } finally {
    loading.value = false;
  }
}

watch(month, (m) => {
  loadMonth(m);
});

// --- 新預約通知 ---
const newBookingCount = ref(0);
const showNotifyModal = ref(false);
const pendingNotifyBookings = ref<Booking[]>([]);
const lastSeenIds = ref<Set<string>>(new Set());

async function checkNewBookings() {
  try {
    const all = await bookingsApi.listAll({ status: '待確認' });
    const currentIds = new Set(all.map((b) => b.id));

    // 找出新增的預約
    const newOnes = all.filter((b) => !lastSeenIds.value.has(b.id));

    if (lastSeenIds.value.size === 0) {
      // 初次進入系統：若有待確認預約，立即彈出通知
      if (all.length > 0) {
        pendingNotifyBookings.value = all;
        newBookingCount.value = all.length;
        showNotifyModal.value = true;
      }
    } else if (newOnes.length > 0) {
      // 輪詢到新預約：彈出通知
      newBookingCount.value += newOnes.length;
      pendingNotifyBookings.value = all;
      showNotifyModal.value = true;
      await loadMonth(month.value);
    }

    lastSeenIds.value = currentIds;
  } catch { /* ignore */ }
}

function closeNotifyModal() {
  showNotifyModal.value = false;
  newBookingCount.value = 0;
}

// --- 預約金設定 ---
const depositSetting = ref<DepositSetting>({ enabled: false, amount: 500, bankInfo: '' });
const showDepositModal = ref(false);
const depositForm = ref({ enabled: false, amount: 500, bankInfo: '' });

async function loadDepositSetting() {
  try {
    depositSetting.value = await settingsApi.getDeposit();
  } catch { /* ignore */ }
}

function openDepositSettings() {
  depositForm.value = { ...depositSetting.value };
  showDepositModal.value = true;
}

async function saveDepositSettings() {
  await settingsApi.updateDeposit(depositForm.value);
  depositSetting.value = { ...depositForm.value };
  showDepositModal.value = false;
}

async function confirmDeposit(b: Booking) {
  await bookingsApi.update(b.id, { status: '待確認', depositStatus: '已付訂金' } as any);
  await loadMonth(month.value);
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  await loadMonth(month.value);
  const [svc, mem] = await Promise.all([servicesApi.list(), membersApi.list()]);
  services.value = svc;
  allMembers.value = mem;
  await loadDepositSetting();
  // 初始化通知
  await checkNewBookings();
  // 每 30 秒輪詢新預約
  pollTimer = setInterval(checkNewBookings, 30000);
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});

function onDateSelect(date: string) {
  selectedDate.value = date;
}

async function changeStatus(b: Booking, next: BookingStatus) {
  await bookingsApi.update(b.id, { status: next });
  toast.show(`已更新為「${next}」`);
  await loadMonth(month.value);
}

function openCreate() {
  editing.value = null;
  form.value = {
    id: '',
    name: '',
    phone: '',
    date: selectedDate.value ?? new Date().toISOString().slice(0, 10),
    time: '',
    items: '',
    total: 0,
    status: '待確認',
    remarks: '',
  };
  selectedServices.value = new Set();
  showModal.value = true;
}

function openEdit(b: Booking) {
  editing.value = b;
  form.value = {
    id: b.id,
    name: b.name,
    phone: b.phone,
    date: b.date,
    time: b.time,
    items: b.items,
    total: b.total,
    status: b.status,
    remarks: b.remarks ?? '',
  };
  // 回填已選服務
  const itemNames = b.items.split('、').map((n) => n.trim());
  const set = new Set<string>();
  for (const s of services.value) {
    if (itemNames.includes(s.name)) set.add(s.id);
  }
  selectedServices.value = set;
  showModal.value = true;
}

async function save() {
  const items = selectedServices.value.size > 0 ? selectedItemsLabel.value : form.value.items;
  const total = selectedServices.value.size > 0 ? selectedTotal.value : Number(form.value.total);
  const duration = selectedServices.value.size > 0 ? selectedDuration.value : null;

  if (editing.value) {
    await bookingsApi.update(editing.value.id, {
      name: form.value.name,
      phone: form.value.phone,
      date: form.value.date,
      time: form.value.time,
      duration,
      items,
      total,
      status: form.value.status,
      remarks: form.value.remarks || null,
    });
  } else {
    await bookingsApi.create({
      name: form.value.name,
      phone: form.value.phone,
      date: form.value.date,
      time: form.value.time,
      duration,
      items,
      total,
      remarks: form.value.remarks || null,
    });
  }
  showModal.value = false;
  toast.show(editing.value ? '預約已更新' : '預約已新增');
  await loadMonth(month.value);
}

async function remove(b: Booking) {
  if (!window.confirm('確定要刪除這筆預約？')) return;
  await bookingsApi.remove(b.id);
  toast.show('預約已刪除');
  await loadMonth(month.value);
}

function formatDateLabel(date: string) {
  const d = new Date(date + 'T00:00:00');
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y} 年 ${m}月 ${day} 日`;
}

// --- 匯出本月剩餘空檔 ---
const showExportModal = ref(false);
const exportText = ref('');
const exportLoading = ref(false);
const exportCopied = ref(false);

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

async function exportAvailableSlots() {
  exportLoading.value = true;
  exportCopied.value = false;
  showExportModal.value = true;
  try {
    // 以日曆目前所在的月份為輸出範圍
    const [yStr, mStr] = month.value.split('-');
    const y = Number(yStr);
    const m = Number(mStr); // 1-based
    const lastDay = new Date(y, m, 0).getDate();

    // 當月為「當前月」→ 從今天開始；其他月份 → 從 1 號開始
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m;
    const startDay = isCurrentMonth ? today.getDate() : 1;

    const pad = (n: number) => String(n).padStart(2, '0');
    const startDate = `${y}-${pad(m)}-${pad(startDay)}`;
    const endDate = `${y}-${pad(m)}-${pad(lastDay)}`;

    const slotsByDate = await bookingsApi.bulkAvailableSlots(startDate, endDate, 60);

    const header = isCurrentMonth
      ? `📅 ${m} 月剩餘可預約時段（60 分鐘以上）`
      : `📅 ${y}/${m} 可預約時段（60 分鐘以上）`;
    const lines: string[] = [header, ''];
    const dates = Object.keys(slotsByDate).sort();
    let hasAny = false;
    for (const d of dates) {
      // 只保留整點時段（例 11:00、12:00，排除 11:30、12:30）
      const times = (slotsByDate[d] ?? []).filter((t) => t.endsWith(':00'));
      if (!times.length) continue;
      hasAny = true;
      const dt = new Date(d + 'T00:00:00');
      const mm = dt.getMonth() + 1;
      const dd = dt.getDate();
      const w = WEEKDAY_LABELS[dt.getDay()];
      lines.push(`${mm}/${dd}（${w}）${times.join(' / ')}`);
    }
    if (!hasAny) {
      lines.push(isCurrentMonth ? '本月已無可預約時段 🙏' : '此月份無可預約時段 🙏');
    }
    lines.push('', '歡迎預約 💕');
    exportText.value = lines.join('\n');
  } catch (err) {
    exportText.value = '載入失敗，請重試';
    console.error(err);
  } finally {
    exportLoading.value = false;
  }
}

async function copyExportText() {
  try {
    await navigator.clipboard.writeText(exportText.value);
    exportCopied.value = true;
    setTimeout(() => { exportCopied.value = false; }, 2000);
  } catch {
    // fallback: select text for manual copy
    exportCopied.value = false;
  }
}

const { refreshing } = usePullRefresh(() => loadMonth(month.value));
</script>

<template>
  <div class="space-y-4">
    <!-- KPI -->
    <div class="grid grid-cols-2 gap-2">
      <div class="card !p-2.5 !rounded-xl relative cursor-pointer" @click="newBookingCount > 0 ? (showNotifyModal = true) : undefined">
        <p class="section-label mb-0.5">今日預約</p>
        <p class="text-base font-extrabold text-brand-600 leading-none">{{ summary?.today.bookings ?? 0 }}</p>
        <p class="section-label mt-0.5">筆</p>
        <!-- 新預約通知 badge -->
        <span
          v-if="newBookingCount > 0"
          class="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-extrabold px-1 animate-bounce"
        >
          +{{ newBookingCount }}
        </span>
      </div>
      <div class="card !p-2.5 !rounded-xl">
        <p class="section-label mb-0.5">今日營收</p>
        <p class="text-xs font-extrabold text-brand-600 leading-none tracking-tight">NT$ {{ summary?.today.revenue ?? 0 }}</p>
        <p class="section-label mt-0.5">已結帳</p>
      </div>
    </div>

    <div class="flex gap-2">
      <button
        type="button"
        class="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold shadow-sm active:scale-[0.98] transition-transform"
        @click="exportAvailableSlots"
      >
        <span>📋</span>
        <span>一鍵輸出本月空檔</span>
      </button>
      <button
        type="button"
        class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shadow-sm active:scale-[0.98] transition-transform"
        :class="depositSetting.enabled ? 'bg-brand-600 text-white' : 'bg-white text-brand-500 border border-brand-200'"
        @click="openDepositSettings"
      >
        <span>💰</span>
        <span>預約金{{ depositSetting.enabled ? ' ON' : ' OFF' }}</span>
      </button>
    </div>

    <SharedCalendar
      v-model="selectedDate"
      :marked-dates="markedDates"
      :grayed-dates="fullyUnavailableDates"
      @update:model-value="onDateSelect"
      @month-change="loadMonth"
    />

    <!-- 日清單 -->
    <section>
      <div class="flex items-center justify-between mb-2">
        <h2 class="font-bold">{{ selectedDate }} 預約</h2>
        <div class="flex gap-2">
          <button
            class="btn-outline text-[10px] !py-1 !px-2.5 flex items-center gap-1"
            @click="openSlotModal(selectedDate!)"
            :disabled="!selectedDate"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            時段管理
          </button>
          <button class="btn-pill text-[10px]" @click="openCreate">+ 新增</button>
        </div>
      </div>
      <p v-if="loading" class="text-center text-brand-400 py-6">載入中…</p>
      <p v-else-if="!dayBookings.length" class="text-center text-brand-400 py-6">本日無預約</p>
      <ul v-else class="space-y-1.5">
        <li v-for="b in dayBookings" :key="b.id" class="card !p-2.5 !rounded-xl">
          <div class="flex justify-between items-start">
            <div>
              <div class="text-[11px] text-brand-500">{{ b.time }}</div>
              <div class="font-bold text-xs">{{ b.name }} · {{ b.phone }}</div>
              <div class="text-[10px] text-brand-500">{{ b.items }}</div>
              <div class="text-xs text-brand-600 font-bold mt-0.5">${{ b.total }}</div>
            </div>
            <span class="badge" :class="statusClass[b.status]">{{ b.status }}</span>
          </div>
          <!-- 預約金提示 -->
          <div v-if="b.status === '待付訂金'" class="flex items-center justify-between mt-1 px-2 py-1 rounded-lg" style="background:#fef3e2;">
            <span class="text-[10px] font-bold" style="color:#8b6914;">待付預約金 ${{ b.depositAmount ?? depositSetting.amount }}</span>
            <button class="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-brand-600 text-white active:scale-95" @click="confirmDeposit(b)">確認收款</button>
          </div>
          <div class="flex gap-1 mt-1.5 flex-wrap">
            <button
              v-for="s in statuses.filter(st => st !== '待付訂金')"
              :key="s"
              type="button"
              class="text-[10px] font-bold px-2 py-0.5 rounded-full transition-all"
              :class="b.status === s
                ? statusClass[s] + ' ring-1 ring-offset-1 ring-brand-300'
                : 'bg-brand-50 text-brand-400'"
              @click="changeStatus(b, s)"
            >
              {{ s }}
            </button>
            <button class="btn-outline !text-[10px] !py-0.5 !px-2 ml-auto" @click="openEdit(b)">編輯</button>
            <button class="btn-outline !text-[10px] !py-0.5 !px-2 !text-red-600 !border-red-200" @click="remove(b)">刪除</button>
          </div>
        </li>
      </ul>
    </section>

    <!-- 下月預估 -->
    <div v-if="summary" class="card !p-2.5 !rounded-xl">
      <h3 class="font-bold text-xs mb-1">下月業績預估</h3>
      <div class="flex justify-between text-[11px]">
        <span class="text-brand-500">預約筆數</span>
        <span class="font-bold">{{ summary.nextMonthEstimate.bookings }}</span>
      </div>
      <div class="flex justify-between text-[11px] mt-0.5">
        <span class="text-brand-500">預估營收</span>
        <span class="font-bold text-brand-600">${{ summary.nextMonthEstimate.revenue }}</span>
      </div>
    </div>

    <!-- 時段管理 Modal -->
    <div v-if="showSlotModal" class="fixed inset-0 z-30 flex items-center justify-center p-5" style="background:rgba(0,0,0,0.5);">
      <div class="bg-white w-full max-w-[360px] max-h-[90vh] overflow-y-auto no-scrollbar" style="border-radius:24px;padding:20px;">
        <div class="flex justify-between items-start mb-2">
          <div>
            <h3 class="font-bold text-base">{{ formatDateLabel(slotDate) }}</h3>
            <p class="text-[10px] text-brand-400 mt-0.5">點時段關閉或解鎖</p>
          </div>
          <button
            class="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-400 hover:bg-brand-100 transition"
            @click="showSlotModal = false"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- 圖例 -->
        <div class="flex gap-4 mb-3 text-[10px] font-bold text-brand-400">
          <span class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-sm bg-brand-600"></span> 已預約
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-sm bg-brand-200"></span> 關閉
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-sm bg-white border border-brand-100"></span> 空檔
          </span>
        </div>

        <!-- 整日快速操作 -->
        <div class="flex gap-2 mb-3">
          <button
            type="button"
            class="flex-1 py-2 rounded-xl text-xs font-bold border border-brand-200 text-brand-500 bg-white hover:bg-brand-50 transition disabled:opacity-50"
            :disabled="slotLoading || bulkSlotLoading"
            @click="blockEntireDay"
          >
            🚫 關閉整日
          </button>
          <button
            type="button"
            class="flex-1 py-2 rounded-xl text-xs font-bold border border-brand-200 text-brand-500 bg-white hover:bg-brand-50 transition disabled:opacity-50"
            :disabled="slotLoading || bulkSlotLoading"
            @click="unblockEntireDay"
          >
            ✨ 恢復整日
          </button>
        </div>

        <p v-if="slotLoading || bulkSlotLoading" class="text-center text-brand-400 py-6 text-xs">載入中…</p>
        <div v-else class="grid grid-cols-3 gap-2">
          <button
            v-for="time in allSlots"
            :key="time"
            type="button"
            class="flex flex-col items-center justify-center py-1.5 rounded-lg border transition-all active:scale-95"
            :class="{
              'bg-brand-600 text-white border-brand-600 cursor-default': getSlotStatus(time) === 'booked' && !isSlotPast(time),
              'bg-brand-100 text-brand-400 border-brand-200': getSlotStatus(time) === 'blocked' && !isSlotPast(time),
              'bg-white text-brand-600 border-brand-100 hover:border-brand-300': getSlotStatus(time) === 'available' && !isSlotPast(time),
              'bg-white text-brand-200 border-brand-100 opacity-60 cursor-default': isSlotPast(time),
            }"
            :disabled="isSlotPast(time)"
            @click="toggleSlot(time)"
          >
            <span class="text-xs font-bold">{{ time }}</span>
            <span class="text-[9px] leading-tight" :class="{
              'text-white/70': getSlotStatus(time) === 'booked' && !isSlotPast(time),
              'text-brand-300': getSlotStatus(time) === 'blocked' && !isSlotPast(time),
              'text-brand-400': getSlotStatus(time) === 'available' && !isSlotPast(time),
              'text-brand-200': isSlotPast(time),
            }">
              {{
                isSlotPast(time) ? '已過' :
                getSlotStatus(time) === 'booked' ? '已預約' :
                getSlotStatus(time) === 'blocked' ? '關閉' : '空檔'
              }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- 預約 Modal -->
    <div v-if="showModal" class="fixed inset-0 z-30 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.5);">
      <div class="bg-white w-full max-w-[360px] flex flex-col" style="border-radius:24px; max-height: 88dvh; overflow: hidden;">
        <!-- Header -->
        <div class="flex justify-between items-start shrink-0" style="padding: 24px 24px 12px;">
          <h3 class="font-bold text-lg">{{ editing ? '編輯預約' : '新增預約' }}</h3>
          <button class="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-400 hover:bg-brand-100 transition" @click="showModal = false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- 可滾動內容 -->
        <div class="flex-1 overflow-y-auto no-scrollbar" style="padding: 0 24px 24px;">
          <!-- 基本資料 -->
          <div class="space-y-2.5">
            <input v-model="form.phone" class="booking-field w-full" placeholder="手機號碼" />
            <div v-if="matchedMember" class="flex items-center gap-2 px-2 py-1.5 bg-green-50 rounded-xl">
              <span class="text-[10px] font-bold text-green-600">已找到會員</span>
              <span class="text-xs font-extrabold text-green-700">{{ matchedMember.name }}</span>
              <span v-if="matchedMember.gender" class="text-[10px] text-green-500">{{ matchedMember.gender }}</span>
            </div>
            <input v-model="form.name" class="booking-field w-full" placeholder="姓名" />

            <!-- 預約時間 -->
            <button
              type="button"
              class="booking-field w-full flex items-center justify-between"
              @click="openFormDatePicker"
            >
              <span class="text-brand-400 text-xs font-bold">選擇日期與時段</span>
              <span v-if="form.date && form.time" class="text-xs font-extrabold text-brand-700">
                {{ formatDateLabel(form.date) }} {{ form.time }}
              </span>
              <span v-else class="text-xs text-brand-300">點擊選擇</span>
            </button>

            <div v-if="editing" class="relative">
              <button type="button" class="booking-field w-full flex items-center justify-between" @click="showStatusPicker = !showStatusPicker">
                <span class="text-brand-400 text-xs font-bold">狀態</span>
                <span class="text-xs font-bold text-brand-700">{{ form.status }}</span>
              </button>
              <div v-if="showStatusPicker" class="custom-dropdown" style="right: 0; left: 0;">
                <button
                  v-for="s in statuses"
                  :key="s"
                  type="button"
                  class="custom-dropdown-item"
                  :class="{ 'custom-dropdown-active': form.status === s }"
                  @click="selectStatus(s)"
                >
                  {{ s }}
                </button>
              </div>
            </div>

            <textarea v-model="form.remarks" class="booking-field w-full resize-none text-xs" rows="2" placeholder="備註..." />
          </div>

          <!-- 項目選擇 -->
          <div class="mt-4 pt-3" style="border-top: 1px dashed #e5e2df;">
            <p class="text-[10px] text-brand-400 font-bold text-center mb-3">項目選擇</p>

            <div class="flex gap-1 mb-2">
              <button
                v-for="t in serviceTabs"
                :key="t.value"
                type="button"
                class="text-[10px] font-bold px-3 py-1.5 rounded-full transition-all"
                :class="serviceTab === t.value
                  ? 'bg-brand-600 text-white'
                  : 'bg-brand-50 text-brand-400'"
                @click="serviceTab = t.value"
              >
                {{ t.label }}
              </button>
            </div>

            <div class="space-y-1.5 max-h-[180px] overflow-y-auto no-scrollbar">
              <button
                v-for="s in filteredFormServices"
                :key="s.id"
                type="button"
                class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left"
                :class="selectedServices.has(s.id)
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-brand-700 border-brand-100'"
                @click="toggleFormService(s.id)"
              >
                <span class="font-bold text-xs">{{ s.name }}</span>
                <span class="font-extrabold text-xs">NT$ {{ s.price }}</span>
              </button>
              <p v-if="!filteredFormServices.length" class="text-center text-brand-400 text-[10px] py-2">無項目</p>
            </div>

            <div v-if="selectedServices.size > 0" class="booking-field mt-2">
              <div class="flex justify-between text-xs">
                <span class="text-brand-400">已選 {{ selectedServices.size }} 項</span>
                <span class="font-extrabold text-brand-600">NT$ {{ selectedTotal }}</span>
              </div>
            </div>
          </div>

        </div>

        <!-- 固定底部按鈕 -->
        <div class="shrink-0 flex gap-2 border-t border-brand-100" style="padding: 16px 24px calc(16px + env(safe-area-inset-bottom, 0px));">
          <button class="btn-outline flex-1" @click="showModal = false">取消</button>
          <button class="btn-primary flex-1" @click="save">儲存</button>
        </div>
      </div>
    </div>

    <!-- Form Date Picker Modal -->
    <div v-if="showFormDatePicker" class="fixed inset-0 z-40 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.5);">
      <div class="bg-white w-full max-w-[360px] flex flex-col" style="border-radius:24px; max-height: 88dvh; overflow: hidden;">
        <div class="flex justify-between items-start shrink-0" style="padding: 24px 24px 12px;">
          <h3 class="font-bold text-lg">選擇預約時間</h3>
          <button class="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-400 hover:bg-brand-100 transition" @click="showFormDatePicker = false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto no-scrollbar" style="padding: 0 18px 24px;">
          <SharedCalendar
            v-model="formCalendarDate"
            :marked-dates="formMarkedDates"
            @update:model-value="onFormCalendarSelect"
            @month-change="loadMonth"
          />

          <div v-if="formCalendarDate" class="mt-4">
            <h4 class="font-bold text-sm mb-3">{{ formatDateLabel(formCalendarDate) }}</h4>

            <div class="flex gap-4 mb-3 text-[10px] font-bold text-brand-400">
              <span class="flex items-center gap-1.5">
                <span class="w-3 h-3 rounded-sm bg-brand-600"></span> 已預約
              </span>
              <span class="flex items-center gap-1.5">
                <span class="w-3 h-3 rounded-sm bg-brand-200"></span> 關閉
              </span>
              <span class="flex items-center gap-1.5">
                <span class="w-3 h-3 rounded-sm bg-white border border-brand-100"></span> 空檔
              </span>
            </div>

            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="time in allSlots"
                :key="time"
                type="button"
                class="flex flex-col items-center justify-center py-3 rounded-xl border transition-all active:scale-95"
                :class="{
                  'bg-brand-600 text-white border-brand-600 cursor-default': getFormSlotStatus(time) === 'booked',
                  'bg-brand-100 text-brand-400 border-brand-200 cursor-default': getFormSlotStatus(time) === 'blocked',
                  'bg-white text-brand-600 border-brand-100 hover:border-brand-300': getFormSlotStatus(time) === 'available',
                }"
                @click="selectFormSlot(time)"
              >
                <span class="text-sm font-bold">{{ time }}</span>
                <span class="text-[10px] mt-0.5" :class="{
                  'text-white/70': getFormSlotStatus(time) === 'booked',
                  'text-brand-300': getFormSlotStatus(time) === 'blocked',
                  'text-brand-400': getFormSlotStatus(time) === 'available',
                }">
                  {{ getFormSlotStatus(time) === 'booked' ? '已預約' : getFormSlotStatus(time) === 'blocked' ? '關閉' : '空檔' }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 匯出空檔 Modal -->
    <div
      v-if="showExportModal"
      class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      @click.self="showExportModal = false"
    >
      <div class="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-bold text-base">本月空檔</h3>
          <button
            type="button"
            class="text-brand-400 hover:text-brand-600 text-xl leading-none"
            @click="showExportModal = false"
          >×</button>
        </div>

        <p v-if="exportLoading" class="text-center text-brand-400 py-8">載入中…</p>

        <template v-else>
          <textarea
            v-model="exportText"
            readonly
            class="w-full h-64 p-3 rounded-xl bg-brand-50 text-sm text-brand-700 font-mono leading-relaxed border-none resize-none focus:outline-none"
          ></textarea>

          <div class="flex gap-2 mt-3">
            <button
              type="button"
              class="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-bold transition-colors"
              :class="{ '!bg-green-600': exportCopied }"
              @click="copyExportText"
            >
              {{ exportCopied ? '已複製 ✓' : '複製到剪貼簿' }}
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- 新預約通知 Modal -->
    <div v-if="showNotifyModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.5);" @click.self="closeNotifyModal">
      <div class="bg-white w-full max-w-[340px] flex flex-col" style="border-radius:28px; max-height: 75dvh; overflow: hidden; animation: notify-pop 0.25s ease-out;">
        <div class="flex justify-between items-center shrink-0" style="padding: 22px 22px 10px;">
          <div class="flex items-center gap-2">
            <span class="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white text-sm font-extrabold">{{ pendingNotifyBookings.length }}</span>
            <h3 class="font-bold text-base">待確認預約</h3>
          </div>
          <button class="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-400 hover:bg-brand-100 transition" @click="closeNotifyModal">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto no-scrollbar" style="padding: 6px 18px 22px;">
          <ul class="space-y-2">
            <li
              v-for="bk in pendingNotifyBookings"
              :key="bk.id"
              class="p-3 rounded-2xl border border-brand-100"
            >
              <div class="flex justify-between items-start">
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-extrabold text-brand-700">{{ bk.name }}</div>
                  <div class="text-[11px] text-brand-400 mt-0.5">{{ bk.phone }}</div>
                  <div class="text-[11px] text-brand-500 font-bold mt-1">{{ bk.date }} {{ bk.time }}</div>
                  <div class="text-[10px] text-brand-400 mt-0.5 truncate">{{ bk.items }}</div>
                </div>
                <div class="text-right shrink-0">
                  <div class="text-sm font-extrabold text-brand-600">NT$ {{ bk.total.toLocaleString() }}</div>
                  <button
                    class="mt-2 text-[10px] font-bold text-white px-3 py-1 rounded-full"
                    style="background:#655b55;"
                    @click="changeStatus(bk, '已確認'); pendingNotifyBookings = pendingNotifyBookings.filter(b => b.id !== bk.id); if (!pendingNotifyBookings.length) closeNotifyModal();"
                  >
                    確認
                  </button>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
    <!-- 預約金設定 Modal -->
    <div v-if="showDepositModal" class="fixed inset-0 z-30 flex items-center justify-center p-5" style="background:rgba(0,0,0,0.5);">
      <div class="bg-white w-full max-w-[320px] no-scrollbar" style="border-radius:24px;padding:24px;">
        <div class="flex justify-between items-start mb-4">
          <h3 class="font-bold text-base">預約金設定</h3>
          <button class="w-7 h-7 rounded-full bg-brand-50 flex items-center justify-center text-brand-400" @click="showDepositModal = false">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="space-y-3">
          <!-- 開關 -->
          <div class="flex items-center justify-between">
            <span class="text-sm font-bold">啟用新客預約金</span>
            <button
              type="button"
              class="shrink-0 w-[44px] h-[26px] rounded-full transition-colors relative"
              :class="depositForm.enabled ? 'bg-brand-600' : 'bg-brand-200'"
              @click="depositForm.enabled = !depositForm.enabled"
            >
              <span
                class="absolute top-[3px] left-[3px] w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                :style="depositForm.enabled ? 'transform: translateX(18px)' : ''"
              ></span>
            </button>
          </div>
          <!-- 金額 -->
          <div>
            <label class="label">預約金金額</label>
            <input v-model.number="depositForm.amount" type="number" class="input" placeholder="500" />
          </div>
          <!-- 匯款資訊 -->
          <div>
            <label class="label">匯款資訊（顯示給客人）</label>
            <textarea v-model="depositForm.bankInfo" class="input" rows="3" placeholder="例：中國信託 822&#10;帳號：1234-5678-9012&#10;戶名：SHANSHAN STUDIO"></textarea>
          </div>
          <button class="btn-primary w-full mt-2" @click="saveDepositSettings">儲存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes notify-pop {
  from { transform: scale(0.9) translateY(20px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}
.booking-field {
  background: #f5f3f1;
  border: none;
  border-radius: 14px;
  padding: 14px 16px;
  font-size: 14px;
  color: #4a423d;
  outline: none;
  position: relative;
}
.booking-field::placeholder {
  color: #b0aba7;
}

.custom-dropdown {
  position: absolute;
  top: 100%;
  margin-top: 6px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  border: 1px solid #f0efed;
  padding: 6px;
  z-index: 50;
}

.custom-dropdown-item {
  display: block;
  width: 100%;
  text-align: center;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  color: #4a423d;
  border: none;
  background: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}
.custom-dropdown-item:hover {
  background: #f5f3f1;
}
.custom-dropdown-active {
  font-weight: 700;
  color: #655b55;
  background: #f5f3f1;
}
</style>
