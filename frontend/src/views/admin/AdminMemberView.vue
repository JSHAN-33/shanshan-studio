<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useToast } from '@/composables/useToast';
import { usePullRefresh } from '@/composables/usePullRefresh';
import SharedCalendar from '@/components/SharedCalendar.vue';
import { membersApi } from '@/api/members';
import { servicesApi } from '@/api/services';
import { bookingsApi } from '@/api/bookings';
import { slotsApi } from '@/api/slots';
import { serviceHistoryApi } from '@/api/serviceHistory';
import type { Member, Service, ServiceCat, AvailableSlot, BlockedSlot, Booking, ServiceHistory } from '@/api/types';

const toast = useToast();
const members = ref<Member[]>([]);
const search = ref('');
const loading = ref(false);
const tagFilter = ref<'all' | 'vip' | 'new' | 'returning' | 'inactive'>('all');

// 回訪提醒天數
const INACTIVE_DAYS = 30;

const showModal = ref(false);
const editing = ref<Member | null>(null);
const form = ref({
  phone: '',
  name: '',
  bday: '',
  gender: '' as '' | '男' | '女',
  note: '',
  vip: false,
  wallet: 0,
});

// --- 性別選擇 ---
const showGenderPicker = ref(false);
const genderOptions = [
  { value: '' as '' | '男' | '女', label: '不設定' },
  { value: '女' as '' | '男' | '女', label: '♀ 女' },
  { value: '男' as '' | '男' | '女', label: '♂ 男' },
];

function selectGender(v: '' | '男' | '女') {
  form.value.gender = v;
  showGenderPicker.value = false;
}

// --- 電話自動帶入 ---
const matchedMember = ref<Member | null>(null);

watch(() => form.value.phone, (phone) => {
  if (editing.value) return; // 編輯模式不觸發
  const p = phone.trim();
  if (!p) { matchedMember.value = null; return; }
  const found = members.value.find((m) => m.phone === p);
  if (found) {
    matchedMember.value = found;
    form.value.name = found.name;
    form.value.bday = found.bday ?? '';
    form.value.gender = (found.gender ?? '') as '' | '男' | '女';
    form.value.note = found.note ?? '';
    form.value.wallet = found.wallet;
  } else {
    matchedMember.value = null;
  }
});

// --- 同步建立預約 ---
const withBooking = ref(false);
const bookingDate = ref('');
const bookingTime = ref('');
const services = ref<Service[]>([]);
const selectedServices = ref<Set<string>>(new Set());
const serviceTab = ref<ServiceCat>('women');
const slots = ref<AvailableSlot[]>([]);
const loadingSlots = ref(false);

const serviceTabs: Array<{ value: ServiceCat; label: string }> = [
  { value: 'women', label: '女生' },
  { value: 'men', label: '男士' },
  { value: 'eyelash', label: '睫毛' },
  { value: 'products', label: '產品' },
];

const filteredServices = computed(() =>
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

const totalDuration = computed(() => {
  let sum = 0;
  for (const s of services.value) {
    if (selectedServices.value.has(s.id)) sum += (s.duration ?? 0);
  }
  return sum;
});

function toggleService(id: string) {
  const set = new Set(selectedServices.value);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  selectedServices.value = set;
}

// --- 預約日曆彈窗 ---
const showBookingPicker = ref(false);
const calendarDate = ref<string | null>(null);
const calendarMonth = ref<string>(new Date().toISOString().slice(0, 7));
const monthBookings = ref<Booking[]>([]);
const allSlots = ref<string[]>([]);
const blockedSlots = ref<BlockedSlot[]>([]);
const slotLoading = ref(false);

// --- 生日日曆彈窗 ---
const showBdayPicker = ref(false);
const bdayCalendarDate = ref<string | null>(null);

function openBdayPicker() {
  bdayCalendarDate.value = form.value.bday || null;
  showBdayPicker.value = true;
}

function selectBday(date: string) {
  form.value.bday = date;
  bdayCalendarDate.value = date;
  showBdayPicker.value = false;
}

const defaultSlots = (() => {
  const s: string[] = [];
  for (let h = 11; h <= 19; h++) {
    s.push(`${String(h).padStart(2, '0')}:00`);
    s.push(`${String(h).padStart(2, '0')}:30`);
  }
  s.push('20:00');
  return s;
})();

const bookedTimesForDate = computed(() => {
  const set = new Set<string>();
  for (const b of monthBookings.value) {
    if (b.date === calendarDate.value && b.status !== '已取消') set.add(b.time);
  }
  return set;
});

const blockedTimesForDate = computed(() => {
  const set = new Set<string>();
  for (const bs of blockedSlots.value) {
    if (bs.date === calendarDate.value) set.add(bs.time);
  }
  return set;
});

const markedDates = computed(() => {
  const set = new Set<string>();
  for (const b of monthBookings.value) if (b.status !== '已取消') set.add(b.date);
  return Array.from(set);
});

function getSlotStatus(time: string): 'booked' | 'blocked' | 'available' {
  if (bookedTimesForDate.value.has(time)) return 'booked';
  if (blockedTimesForDate.value.has(time)) return 'blocked';
  return 'available';
}

async function loadCalendarMonth(m: string) {
  calendarMonth.value = m;
  try {
    const [list, config, blocked] = await Promise.all([
      bookingsApi.listAll({ month: m }),
      slotsApi.getConfig(),
      slotsApi.listBlocked(m),
    ]);
    monthBookings.value = list;
    allSlots.value = config.length > 0 ? config : defaultSlots;
    blockedSlots.value = blocked;
  } catch { /* ignore */ }
}

function openBookingPicker() {
  calendarDate.value = bookingDate.value || null;
  showBookingPicker.value = true;
  loadCalendarMonth(calendarMonth.value);
}

async function onCalendarDateSelect(date: string) {
  calendarDate.value = date;
  slotLoading.value = true;
  try {
    const [config, blocked] = await Promise.all([
      slotsApi.getConfig(),
      slotsApi.listBlocked(calendarMonth.value),
    ]);
    allSlots.value = config.length > 0 ? config : defaultSlots;
    blockedSlots.value = blocked;
  } finally { slotLoading.value = false; }
}

function selectSlot(time: string) {
  const status = getSlotStatus(time);
  if (status !== 'available') return;
  bookingDate.value = calendarDate.value ?? '';
  bookingTime.value = time;
  showBookingPicker.value = false;
}

// --- Wallet ---
const showWalletModal = ref(false);
const walletTarget = ref<Member | null>(null);
const walletDelta = ref(0);
const walletMode = ref<'adjust' | 'set'>('adjust');
const walletSetValue = ref(0);

function daysSinceVisit(m: Member): number | null {
  if (!m.lastVisitAt) return null;
  const last = new Date(m.lastVisitAt + 'T00:00:00');
  const now = new Date();
  return Math.floor((now.getTime() - last.getTime()) / 86400000);
}

function getMemberTag(m: Member): '新客' | '回頭客' {
  return (m.bookingCount ?? 0) > 0 ? '回頭客' : '新客';
}

const filtered = computed(() => {
  let list = members.value;

  // 標籤篩選
  if (tagFilter.value === 'vip') list = list.filter((m) => m.vip);
  else if (tagFilter.value === 'new') list = list.filter((m) => (m.bookingCount ?? 0) === 0);
  else if (tagFilter.value === 'returning') list = list.filter((m) => (m.bookingCount ?? 0) > 0);
  else if (tagFilter.value === 'inactive') list = list.filter((m) => {
    const days = daysSinceVisit(m);
    return days !== null && days >= INACTIVE_DAYS;
  });

  // 搜尋
  const q = search.value.trim();
  if (q) list = list.filter((m) => m.name.includes(q) || m.phone.includes(q));
  return list;
});

async function load() {
  loading.value = true;
  try {
    members.value = await membersApi.list();
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await load();
  services.value = await servicesApi.list();
});

function openCreate() {
  editing.value = null;
  form.value = { phone: '', name: '', bday: '', gender: '', note: '', vip: false, wallet: 0 };
  withBooking.value = false;
  bookingDate.value = '';
  bookingTime.value = '';
  selectedServices.value = new Set();
  showModal.value = true;
}

function openEdit(m: Member) {
  editing.value = m;
  form.value = {
    phone: m.phone,
    name: m.name,
    bday: m.bday ?? '',
    gender: (m.gender ?? '') as '' | '男' | '女',
    note: m.note ?? '',
    vip: m.vip,
    wallet: m.wallet,
  };
  withBooking.value = false;
  bookingDate.value = '';
  bookingTime.value = '';
  selectedServices.value = new Set();
  showModal.value = true;
}

async function save() {
  // 儲存會員
  await membersApi.upsert({
    phone: form.value.phone,
    name: form.value.name,
    bday: form.value.bday || null,
    gender: form.value.gender || null,
    note: form.value.note || null,
    vip: form.value.vip,
  });

  // 同步建立預約
  if (bookingDate.value && bookingTime.value && selectedServices.value.size > 0) {
    await bookingsApi.create({
      name: form.value.name,
      phone: form.value.phone,
      date: bookingDate.value,
      time: bookingTime.value,
      items: selectedItemsLabel.value,
      total: selectedTotal.value,
    });
  }

  showModal.value = false;
  toast.show(editing.value ? '會員已更新' : '會員已新增');
  await load();
}

function openWallet(m: Member) {
  walletTarget.value = m;
  walletDelta.value = 0;
  walletMode.value = 'adjust';
  walletSetValue.value = m.wallet;
  showWalletModal.value = true;
}

async function saveWallet() {
  if (!walletTarget.value) { showWalletModal.value = false; return; }

  if (walletMode.value === 'set') {
    const delta = Number(walletSetValue.value) - walletTarget.value.wallet;
    if (delta === 0) { showWalletModal.value = false; return; }
    await membersApi.adjustWallet(walletTarget.value.phone, delta);
  } else {
    if (!walletDelta.value) { showWalletModal.value = false; return; }
    await membersApi.adjustWallet(walletTarget.value.phone, Number(walletDelta.value));
  }

  showWalletModal.value = false;
  toast.show('儲值金已更新');
  await load();
}

async function removeMember(m: Member) {
  if (!window.confirm(`確定要刪除會員「${m.name}」嗎？此操作無法復原。`)) return;
  await membersApi.remove(m.phone);
  await load();
}

// --- 消費紀錄 ---
// 新增進來的會變成「未結帳」的預約；結帳後會算入財務
const showHistoryModal = ref(false);
const historyTarget = ref<Member | null>(null);
const historyBookings = ref<Booking[]>([]); // 會員的所有預約
const historyLegacy = ref<ServiceHistory[]>([]); // 舊的 ServiceHistory 紀錄（唯讀顯示）
const historyLoading = ref(false);
const historyDatePickerOpen = ref(false);
const historyForm = ref({
  id: '' as string,
  date: '',
  time: '12:00',
  items: '',
  total: 0,
  remarks: '',
});
const historyCalendarDate = ref<string | null>(null);

// 消費紀錄的項目選擇器（獨立於建立預約的 selectedServices）
const historyServiceTab = ref<ServiceCat>('women');
const historySelectedServices = ref<Set<string>>(new Set());
const historyFilteredServices = computed(() =>
  services.value.filter((s) => s.cat === historyServiceTab.value)
);
const historyManualEdit = ref(false); // 若使用者手動改過 items/total，停止自動覆寫

function toggleHistoryService(id: string) {
  const set = new Set(historySelectedServices.value);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  historySelectedServices.value = set;

  // 依選擇自動帶入 items & total
  const picked = services.value.filter((s) => set.has(s.id));
  historyForm.value.items = picked.map((s) => s.name).join('、');
  historyForm.value.total = picked.reduce((sum, s) => sum + s.price, 0);
  historyManualEdit.value = false;
}

function resetHistoryForm() {
  historyForm.value = { id: '', date: '', time: '12:00', items: '', total: 0, remarks: '' };
  historyCalendarDate.value = null;
  historySelectedServices.value = new Set();
  historyManualEdit.value = false;
}

async function reloadHistoryData(phone: string) {
  const [bs, hs] = await Promise.all([
    bookingsApi.listByPhone(phone),
    serviceHistoryApi.listByPhone(phone).catch(() => []),
  ]);
  historyBookings.value = bs;
  historyLegacy.value = hs;
}

async function openHistory(m: Member) {
  historyTarget.value = m;
  resetHistoryForm();
  showHistoryModal.value = true;
  historyLoading.value = true;
  try {
    await reloadHistoryData(m.phone);
  } finally {
    historyLoading.value = false;
  }
}

function editHistory(b: Booking) {
  historyForm.value = {
    id: b.id,
    date: b.date,
    time: b.time,
    items: b.items,
    total: b.total,
    remarks: b.remarks ?? '',
  };
  historyCalendarDate.value = b.date;
  // 編輯時清空選擇器（因為是自由文字，不一定對得上服務項目）
  historySelectedServices.value = new Set();
  historyManualEdit.value = true;
}

function openHistoryDatePicker() {
  historyCalendarDate.value = historyForm.value.date || null;
  historyDatePickerOpen.value = true;
}

function selectHistoryDate(date: string) {
  historyForm.value.date = date;
  historyCalendarDate.value = date;
  historyDatePickerOpen.value = false;
}

const historySaving = ref(false);

async function saveHistory() {
  if (!historyTarget.value || historySaving.value) return;
  const { id, date, time, items, total, remarks } = historyForm.value;
  if (!date || !items.trim() || total < 0) {
    window.alert('請填寫日期、項目與金額');
    return;
  }
  const trimmedTime = (time || '12:00').trim();
  historySaving.value = true;
  try {
    if (id) {
      // 編輯既有預約（不異動 paidAt / status）
      await bookingsApi.update(id, {
        date,
        time: trimmedTime,
        items: items.trim(),
        total: Number(total),
        remarks: remarks.trim() || null,
      });
    } else {
      // 新增 → 建立「未結帳」預約（paidAt 由結帳時寫入）
      // 使用 admin 專用路徑：不檢查時段衝突、不推播 LINE
      await bookingsApi.adminCreate({
        name: historyTarget.value.name,
        phone: historyTarget.value.phone,
        bday: historyTarget.value.bday ?? null,
        lineUserId: historyTarget.value.lineUserId ?? null,
        date,
        time: trimmedTime,
        items: items.trim(),
        total: Number(total),
        remarks: remarks.trim() || null,
      });
    }
    resetHistoryForm();
    await reloadHistoryData(historyTarget.value.phone);
  } catch (err) {
    const e = err as { response?: { status?: number; data?: { message?: string; error?: string } } };
    const msg = e.response?.data?.message || e.response?.data?.error || '儲存失敗，請稍後再試';
    window.alert(`儲存失敗：${msg}${e.response?.status ? ` (HTTP ${e.response.status})` : ''}`);
  } finally {
    historySaving.value = false;
  }
}

async function removeHistoryBooking(b: Booking) {
  if (!historyTarget.value) return;
  if (!window.confirm(`確定要刪除此筆消費紀錄？`)) return;
  await bookingsApi.remove(b.id);
  await reloadHistoryData(historyTarget.value.phone);
}

async function removeLegacyHistory(h: ServiceHistory) {
  if (!historyTarget.value) return;
  if (!window.confirm(`確定要刪除此筆舊消費紀錄？`)) return;
  await serviceHistoryApi.remove(h.id);
  await reloadHistoryData(historyTarget.value.phone);
}

function formatDateLabel(date: string) {
  if (!date) return '';
  const d = new Date(date + 'T00:00:00');
  return `${d.getFullYear()} 年 ${d.getMonth() + 1}月 ${d.getDate()} 日`;
}

const { refreshing } = usePullRefresh(load);
</script>

<template>
  <div class="space-y-4">
    <!-- 下拉刷新提示 -->
    <p v-if="refreshing" class="text-center text-brand-400 text-xs py-1">刷新中…</p>

    <div class="flex gap-2">
      <input v-model="search" class="input flex-1" placeholder="搜尋姓名 / 手機" />
      <button class="btn-pill text-[10px]" @click="openCreate">+ 新增</button>
    </div>

    <!-- 標籤篩選 -->
    <div class="flex gap-1.5 flex-wrap">
      <button
        v-for="t in [
          { value: 'all' as const, label: '全部' },
          { value: 'vip' as const, label: 'VIP' },
          { value: 'new' as const, label: '新客' },
          { value: 'returning' as const, label: '回頭客' },
          { value: 'inactive' as const, label: '待回訪' },
        ]"
        :key="t.value"
        type="button"
        class="px-3 py-1.5 text-[10px] font-bold rounded-full transition-all"
        :class="tagFilter === t.value
          ? 'bg-brand-600 text-white'
          : 'bg-brand-50 text-brand-400'"
        @click="tagFilter = t.value"
      >
        {{ t.label }}
      </button>
    </div>

    <p v-if="loading" class="text-center text-brand-400 py-6">載入中…</p>
    <ul v-else class="space-y-2">
      <li v-for="m in filtered" :key="m.id" class="card !py-2 space-y-1">
        <div class="flex items-center gap-2.5">
          <img
            v-if="m.pictureUrl"
            :src="m.pictureUrl"
            class="w-8 h-8 rounded-full object-cover shrink-0"
            style="border: 1.5px solid #f0efed;"
          />
          <div v-else class="w-8 h-8 rounded-full shrink-0 bg-brand-100 flex items-center justify-center" style="border: 1.5px solid #f0efed;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b0aba7" stroke-width="1.8"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-sm truncate leading-tight">{{ m.name }}</span>
              <span v-if="m.vip" class="text-[8px] font-extrabold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">VIP</span>
              <span
                class="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                :class="getMemberTag(m) === '新客' ? 'text-blue-600 bg-blue-50' : 'text-green-600 bg-green-50'"
              >{{ getMemberTag(m) }}</span>
            </div>
            <div class="text-[11px] text-brand-500">{{ m.phone }}</div>
          </div>
          <div class="text-right shrink-0">
            <div class="text-sm font-extrabold text-brand-600">NT$ {{ m.wallet }}</div>
          </div>
        </div>
        <div class="flex items-center gap-3 text-[10px] text-brand-400 pl-[42px]">
          <span v-if="m.bday">🎂 {{ m.bday }}</span>
          <span v-if="m.gender">{{ m.gender === '女' ? '♀' : '♂' }} {{ m.gender }}</span>
          <span v-if="daysSinceVisit(m) !== null" :class="daysSinceVisit(m)! >= INACTIVE_DAYS ? 'text-red-500 font-bold' : ''">
            {{ daysSinceVisit(m)! >= INACTIVE_DAYS ? '⚠️ ' : '' }}{{ daysSinceVisit(m) }} 天前到訪
          </span>
          <span v-else-if="(m.bookingCount ?? 0) > 0" class="text-brand-300">無到訪紀錄</span>
        </div>
        <div class="flex gap-1.5 pt-0.5">
          <button class="btn-outline text-xs !py-0.5 flex-1" @click="openEdit(m)">編輯</button>
          <button class="btn-outline text-xs !py-0.5 flex-1" @click="openWallet(m)">儲值金</button>
          <button class="btn-outline text-xs !py-0.5 flex-1" @click="openHistory(m)">消費紀錄</button>
          <button class="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 transition shrink-0" @click="removeMember(m)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </li>
      <li v-if="!filtered.length" class="text-center text-brand-400 py-6">尚無會員</li>
    </ul>

    <!-- Member Modal -->
    <div v-if="showModal" class="fixed inset-0 z-30 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.5);">
      <div class="bg-white w-full max-w-[360px] flex flex-col" style="border-radius:24px; max-height: 88dvh; overflow: hidden;">
        <!-- Header (固定) -->
        <div class="flex justify-between items-start shrink-0" style="padding: 24px 24px 12px;">
          <h3 class="font-bold text-lg">{{ editing ? '編輯會員' : '新增會員' }}</h3>
          <button class="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-400 hover:bg-brand-100 transition" @click="showModal = false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- 可滾動內容 -->
        <div class="flex-1 overflow-y-auto no-scrollbar" style="padding: 0 24px 24px;">
          <!-- 基本資料 -->
          <div class="space-y-2.5">
            <input v-model="form.phone" class="member-field w-full" placeholder="手機號碼" :disabled="!!editing" />
            <div v-if="matchedMember && !editing" class="flex items-center gap-2 px-2 py-1.5 bg-green-50 rounded-xl">
              <span class="text-[10px] font-bold text-green-600">已找到會員</span>
              <span class="text-xs font-extrabold text-green-700">{{ matchedMember.name }}</span>
              <span v-if="matchedMember.gender" class="text-[10px] text-green-500">{{ matchedMember.gender }}</span>
            </div>
            <input v-model="form.name" class="member-field w-full" placeholder="姓名" />

            <!-- 生日 + 性別 同一行 -->
            <div class="flex gap-2">
              <button type="button" class="flex-1 member-field flex items-center justify-between" @click="openBdayPicker">
                <span class="text-brand-400 text-xs font-bold">生日</span>
                <span v-if="form.bday" class="text-xs font-extrabold text-brand-700">{{ formatDateLabel(form.bday) }}</span>
                <span v-else class="text-xs text-brand-300">點擊選擇</span>
              </button>
              <div class="relative" style="min-width: 100px;">
                <button type="button" class="member-field w-full flex items-center justify-between" @click="showGenderPicker = !showGenderPicker">
                  <span class="text-brand-400 text-xs font-bold">性別</span>
                  <span class="text-xs font-bold text-brand-700">{{ form.gender || '不設定' }}</span>
                </button>
                <div v-if="showGenderPicker" class="custom-dropdown" style="right: 0; min-width: 110px;">
                  <button
                    v-for="g in genderOptions"
                    :key="g.value"
                    type="button"
                    class="custom-dropdown-item"
                    :class="{ 'custom-dropdown-active': form.gender === g.value }"
                    @click="selectGender(g.value)"
                  >
                    {{ g.label }}
                  </button>
                </div>
              </div>
            </div>

            <div class="member-field flex items-center justify-between">
              <span class="text-brand-400 text-xs font-bold">儲值金餘額</span>
              <div class="flex items-center gap-1">
                <span class="text-xs text-brand-400">NT$</span>
                <span class="text-base font-extrabold text-brand-700">{{ form.wallet }}</span>
              </div>
            </div>

            <!-- VIP 開關 -->
            <button
              type="button"
              class="member-field w-full flex items-center justify-between"
              @click="form.vip = !form.vip"
            >
              <span class="text-brand-400 text-xs font-bold">VIP 會員</span>
              <div class="shrink-0 w-[40px] h-[24px] rounded-full transition-colors relative"
                :class="form.vip ? 'bg-amber-500' : 'bg-brand-200'"
              >
                <span class="absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                  :style="form.vip ? 'transform: translateX(16px)' : ''"
                ></span>
              </div>
            </button>

            <textarea v-model="form.note" class="member-field w-full resize-none text-xs" rows="2" placeholder="備註：特殊膚質、偏好項目..." />
          </div>

          <!-- 項目選擇 -->
          <div class="mt-4 pt-3" style="border-top: 1px dashed #e5e2df;">
            <p class="text-[10px] text-brand-400 font-bold text-center mb-3">項目選擇</p>

            <!-- 服務分類 tabs -->
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

            <!-- 服務列表 -->
            <div class="space-y-1.5 max-h-[180px] overflow-y-auto no-scrollbar">
              <button
                v-for="s in filteredServices"
                :key="s.id"
                type="button"
                class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left"
                :class="selectedServices.has(s.id)
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-brand-700 border-brand-100'"
                @click="toggleService(s.id)"
              >
                <span class="font-bold text-xs">{{ s.name }}</span>
                <span class="font-extrabold text-xs">NT$ {{ s.price }}</span>
              </button>
              <p v-if="!filteredServices.length" class="text-center text-brand-400 text-[10px] py-2">無項目</p>
            </div>

            <!-- 已選摘要 -->
            <div v-if="selectedServices.size > 0" class="member-field mt-2">
              <div class="flex justify-between text-xs">
                <span class="text-brand-400">已選 {{ selectedServices.size }} 項</span>
                <span class="font-extrabold text-brand-600">NT$ {{ selectedTotal }}</span>
              </div>
            </div>
          </div>

          <!-- 預約時間（選填） -->
          <div v-if="selectedServices.size > 0" class="mt-3 pt-3" style="border-top: 1px dashed #e5e2df;">
            <p class="text-[10px] text-brand-400 font-bold text-center mb-3">預約時間（選填）</p>
            <button
              type="button"
              class="member-field w-full flex items-center justify-between"
              @click="openBookingPicker"
            >
              <span class="text-brand-400 text-xs font-bold">選擇日期與時段</span>
              <span v-if="bookingDate && bookingTime" class="text-xs font-extrabold text-brand-700">
                {{ formatDateLabel(bookingDate) }} {{ bookingTime }}
              </span>
              <span v-else class="text-xs text-brand-300">點擊選擇</span>
            </button>
          </div>

        </div><!-- 滾動區域結束 -->

        <!-- 固定底部按鈕 -->
        <div class="shrink-0 flex gap-2 border-t border-brand-100" style="padding: 16px 24px calc(16px + env(safe-area-inset-bottom, 0px));">
          <button class="btn-outline flex-1" @click="showModal = false">取消</button>
          <button class="btn-primary flex-1" @click="save">儲存</button>
        </div>
      </div>
    </div>

    <!-- Birthday Picker Modal -->
    <div v-if="showBdayPicker" class="fixed inset-0 z-40 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.5);">
      <div class="bg-white w-full max-w-[360px]" style="border-radius:24px; overflow: hidden;">
        <div class="flex justify-between items-start" style="padding: 24px 24px 12px;">
          <h3 class="font-bold text-lg">選擇生日</h3>
          <button class="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-400 hover:bg-brand-100 transition" @click="showBdayPicker = false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div style="padding: 0 18px 24px;">
          <SharedCalendar
            v-model="bdayCalendarDate"
            @update:model-value="selectBday"
          />
        </div>
      </div>
    </div>

    <!-- Booking Picker Modal -->
    <div v-if="showBookingPicker" class="fixed inset-0 z-40 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.5);">
      <div class="bg-white w-full max-w-[360px] flex flex-col" style="border-radius:24px; max-height: 88dvh; overflow: hidden;">
        <div class="flex justify-between items-start shrink-0" style="padding: 24px 24px 12px;">
          <h3 class="font-bold text-lg">選擇預約時間</h3>
          <button class="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-400 hover:bg-brand-100 transition" @click="showBookingPicker = false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto no-scrollbar" style="padding: 0 18px 24px;">
          <SharedCalendar
            v-model="calendarDate"
            :marked-dates="markedDates"
            @update:model-value="onCalendarDateSelect"
            @month-change="loadCalendarMonth"
          />

          <!-- 時段選擇 -->
          <div v-if="calendarDate" class="mt-4">
            <div class="flex justify-between items-center mb-3">
              <h4 class="font-bold text-sm">{{ formatDateLabel(calendarDate) }}</h4>
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

            <p v-if="slotLoading" class="text-center text-brand-400 py-6 text-xs">載入中…</p>
            <div v-else class="grid grid-cols-3 gap-2">
              <button
                v-for="time in allSlots"
                :key="time"
                type="button"
                class="flex flex-col items-center justify-center py-3 rounded-xl border transition-all active:scale-95"
                :class="{
                  'bg-brand-600 text-white border-brand-600 cursor-default': getSlotStatus(time) === 'booked',
                  'bg-brand-100 text-brand-400 border-brand-200 cursor-default': getSlotStatus(time) === 'blocked',
                  'bg-white text-brand-600 border-brand-100 hover:border-brand-300': getSlotStatus(time) === 'available',
                }"
                @click="selectSlot(time)"
              >
                <span class="text-sm font-bold">{{ time }}</span>
                <span class="text-[10px] mt-0.5" :class="{
                  'text-white/70': getSlotStatus(time) === 'booked',
                  'text-brand-300': getSlotStatus(time) === 'blocked',
                  'text-brand-400': getSlotStatus(time) === 'available',
                }">
                  {{ getSlotStatus(time) === 'booked' ? '已預約' : getSlotStatus(time) === 'blocked' ? '關閉' : '空檔' }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Wallet Modal -->
    <div v-if="showWalletModal" class="fixed inset-0 z-30 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.5);">
      <div class="bg-white w-full max-w-[360px] flex flex-col" style="border-radius:24px; max-height: 88dvh; overflow: hidden;">
        <div class="flex justify-between items-start shrink-0" style="padding: 24px 24px 12px;">
          <h3 class="font-bold text-lg">儲值金 — {{ walletTarget?.name }}</h3>
          <button class="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-400 hover:bg-brand-100 transition" @click="showWalletModal = false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto no-scrollbar" style="padding: 0 24px 24px;">
          <!-- 目前餘額 -->
          <div class="member-field flex items-center justify-between mb-4">
            <span class="text-brand-400 text-xs font-bold">目前餘額</span>
            <div class="flex items-center gap-1">
              <span class="text-xs text-brand-400">NT$</span>
              <span class="text-xl font-extrabold text-brand-700">{{ walletTarget?.wallet ?? 0 }}</span>
            </div>
          </div>

          <!-- 模式切換 -->
          <div class="flex gap-2 mb-4">
            <button
              type="button"
              class="flex-1 py-2.5 text-xs font-bold text-center rounded-xl border-[1.5px] transition-all"
              :class="walletMode === 'adjust' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-brand-500 border-brand-200'"
              @click="walletMode = 'adjust'"
            >加值 / 扣款</button>
            <button
              type="button"
              class="flex-1 py-2.5 text-xs font-bold text-center rounded-xl border-[1.5px] transition-all"
              :class="walletMode === 'set' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-brand-500 border-brand-200'"
              @click="walletMode = 'set'"
            >直接設定金額</button>
          </div>

          <!-- 加值/扣款 -->
          <div v-if="walletMode === 'adjust'" class="space-y-2">
            <div class="member-field flex items-center justify-between">
              <span class="text-brand-400 text-xs font-bold">變動金額</span>
              <input v-model.number="walletDelta" type="number" class="bg-transparent outline-none text-right text-lg font-extrabold text-brand-700" style="border:none; width: 120px;" placeholder="0" />
            </div>
            <p class="text-[10px] text-brand-400 ml-1">正數 = 加值，負數 = 扣款</p>
            <div v-if="walletDelta && walletTarget" class="member-field flex items-center justify-between">
              <span class="text-brand-400 text-xs font-bold">變動後餘額</span>
              <span class="text-sm font-extrabold" :class="(walletTarget.wallet + walletDelta) >= 0 ? 'text-green-600' : 'text-red-600'">
                NT$ {{ walletTarget.wallet + walletDelta }}
              </span>
            </div>
          </div>

          <!-- 直接設定 -->
          <div v-else class="space-y-2">
            <div class="member-field flex items-center justify-between">
              <span class="text-brand-400 text-xs font-bold">設定金額</span>
              <div class="flex items-center gap-1">
                <span class="text-xs text-brand-400">NT$</span>
                <input v-model.number="walletSetValue" type="number" class="bg-transparent outline-none text-right text-lg font-extrabold text-brand-700" style="border:none; width: 120px;" />
              </div>
            </div>
          </div>

        </div>

        <!-- 固定底部按鈕 -->
        <div class="shrink-0 flex gap-2 border-t border-brand-100" style="padding: 16px 24px calc(16px + env(safe-area-inset-bottom, 0px));">
          <button class="btn-outline flex-1" @click="showWalletModal = false">取消</button>
          <button class="btn-primary flex-1" @click="saveWallet">確認</button>
        </div>
      </div>
    </div>

    <!-- 消費紀錄 Modal -->
    <div v-if="showHistoryModal" class="fixed inset-0 z-30 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.5);">
      <div class="bg-white w-full max-w-[380px] flex flex-col" style="border-radius:24px; max-height: 88dvh; overflow: hidden;">
        <div class="flex justify-between items-start shrink-0" style="padding: 24px 24px 12px;">
          <h3 class="font-bold text-lg">消費紀錄 — {{ historyTarget?.name }}</h3>
          <button class="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-400 hover:bg-brand-100 transition" @click="showHistoryModal = false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto no-scrollbar" style="padding: 0 24px 24px;">
          <!-- 新增 / 編輯表單 -->
          <div class="space-y-2.5">
            <p class="text-[10px] text-brand-400 font-bold">
              {{ historyForm.id ? '編輯' : '新增一筆（會進入未結帳）' }}
            </p>
            <div class="flex gap-2">
              <button type="button" class="member-field flex-1 flex items-center justify-between" @click="openHistoryDatePicker">
                <span class="text-brand-400 text-xs font-bold">日期</span>
                <span v-if="historyForm.date" class="text-xs font-extrabold text-brand-700">{{ formatDateLabel(historyForm.date) }}</span>
                <span v-else class="text-xs text-brand-300">點擊選擇</span>
              </button>
              <div class="member-field flex items-center gap-2" style="width: 110px;">
                <span class="text-brand-400 text-xs font-bold">時間</span>
                <input
                  v-model="historyForm.time"
                  type="time"
                  class="bg-transparent outline-none text-right text-xs font-extrabold text-brand-700 flex-1 min-w-0"
                  style="border:none;"
                />
              </div>
            </div>

            <!-- 項目選擇器 -->
            <div>
              <div class="flex gap-1 mb-2">
                <button
                  v-for="t in serviceTabs"
                  :key="t.value"
                  type="button"
                  class="text-[10px] font-bold px-3 py-1.5 rounded-full transition-all"
                  :class="historyServiceTab === t.value
                    ? 'bg-brand-600 text-white'
                    : 'bg-brand-50 text-brand-400'"
                  @click="historyServiceTab = t.value"
                >
                  {{ t.label }}
                </button>
              </div>
              <div class="space-y-1.5 max-h-[180px] overflow-y-auto no-scrollbar">
                <button
                  v-for="s in historyFilteredServices"
                  :key="s.id"
                  type="button"
                  class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left"
                  :class="historySelectedServices.has(s.id)
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-brand-700 border-brand-100'"
                  @click="toggleHistoryService(s.id)"
                >
                  <span class="font-bold text-xs">{{ s.name }}</span>
                  <span class="font-extrabold text-xs">NT$ {{ s.price }}</span>
                </button>
                <p v-if="!historyFilteredServices.length" class="text-center text-brand-400 text-[10px] py-2">無項目</p>
              </div>
            </div>

            <!-- 項目（可微調覆寫） -->
            <input
              v-model="historyForm.items"
              class="member-field w-full"
              placeholder="項目（可直接輸入或由上方選擇）"
              @input="historyManualEdit = true"
            />
            <div class="member-field flex items-center justify-between">
              <span class="text-brand-400 text-xs font-bold">金額</span>
              <div class="flex items-center gap-1">
                <span class="text-xs text-brand-400">NT$</span>
                <input
                  v-model.number="historyForm.total"
                  type="number"
                  class="bg-transparent outline-none text-right text-lg font-extrabold text-brand-700"
                  style="border:none; width: 120px;"
                  placeholder="0"
                  @input="historyManualEdit = true"
                />
              </div>
            </div>
            <textarea v-model="historyForm.remarks" class="member-field w-full resize-none text-xs" rows="2" placeholder="備註（選填）" />
            <div class="flex gap-2">
              <button v-if="historyForm.id" type="button" class="btn-outline flex-1 text-xs !py-2" @click="resetHistoryForm">取消編輯</button>
              <button type="button" class="btn-primary flex-1 text-xs !py-2" :disabled="historySaving" @click="saveHistory">
                {{ historySaving ? '儲存中…' : historyForm.id ? '更新' : '新增' }}
              </button>
            </div>
          </div>

          <!-- 預約 / 消費列表 -->
          <div class="mt-5 pt-3" style="border-top: 1px dashed #e5e2df;">
            <div class="flex items-center justify-between mb-2">
              <p class="text-[10px] text-brand-400 font-bold">預約 / 消費紀錄</p>
              <p class="text-[10px] text-brand-400">
                共 {{ historyBookings.length }} 筆
                <span v-if="historyBookings.length" class="ml-1">
                  · NT$ {{ historyBookings.reduce((s, b) => s + b.total, 0).toLocaleString() }}
                </span>
              </p>
            </div>
            <p v-if="historyLoading" class="text-center text-brand-400 py-4 text-xs">載入中…</p>
            <p v-else-if="!historyBookings.length" class="text-center text-brand-400 py-4 text-xs">尚無紀錄</p>
            <ul v-else class="space-y-2">
              <li v-for="b in historyBookings" :key="b.id" class="card !p-3">
                <div class="flex justify-between items-start gap-2">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5">
                      <span class="text-[10px] text-brand-400">{{ b.date }} {{ b.time }}</span>
                      <span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full" :class="{
                        'bg-amber-50 text-amber-600': !b.paidAt && b.status !== '已取消',
                        'bg-green-50 text-green-700': !!b.paidAt,
                        'bg-brand-50 text-brand-400': b.status === '已取消',
                      }">
                        {{ b.paidAt ? '已結帳' : b.status === '已取消' ? '已取消' : '未結帳' }}
                      </span>
                    </div>
                    <div class="font-bold text-xs mt-0.5 text-brand-700 truncate">{{ b.items }}</div>
                    <div v-if="b.remarks" class="text-[10px] text-brand-400 mt-1 truncate">備註：{{ b.remarks }}</div>
                  </div>
                  <div class="shrink-0 text-right">
                    <div class="text-brand-600 font-extrabold text-sm">NT$ {{ b.total }}</div>
                    <div class="flex gap-1 mt-1.5 justify-end">
                      <button v-if="!b.paidAt" class="text-[10px] text-brand-500 underline" @click="editHistory(b)">編輯</button>
                      <button v-if="!b.paidAt" class="text-[10px] text-red-500 underline" @click="removeHistoryBooking(b)">刪除</button>
                      <span v-else class="text-[10px] text-brand-300">已鎖定</span>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
          </div>

          <!-- 舊的 ServiceHistory（唯讀；僅保留既有資料顯示） -->
          <div v-if="historyLegacy.length" class="mt-5 pt-3" style="border-top: 1px dashed #e5e2df;">
            <p class="text-[10px] text-brand-400 font-bold mb-2">舊紀錄（唯讀）</p>
            <ul class="space-y-2">
              <li v-for="h in historyLegacy" :key="h.id" class="card !p-3">
                <div class="flex justify-between items-start gap-2">
                  <div class="min-w-0 flex-1">
                    <div class="text-[10px] text-brand-400">{{ h.date }}</div>
                    <div class="font-bold text-xs mt-0.5 text-brand-700 truncate">{{ h.items }}</div>
                    <div v-if="h.remarks" class="text-[10px] text-brand-400 mt-1 truncate">備註：{{ h.remarks }}</div>
                  </div>
                  <div class="shrink-0 text-right">
                    <div class="text-brand-600 font-extrabold text-sm">NT$ {{ h.total }}</div>
                    <button class="text-[10px] text-red-500 underline mt-1.5" @click="removeLegacyHistory(h)">刪除</button>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- 消費紀錄日期選擇 -->
    <div v-if="historyDatePickerOpen" class="fixed inset-0 z-40 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.5);">
      <div class="bg-white w-full max-w-[360px]" style="border-radius:24px; overflow: hidden;">
        <div class="flex justify-between items-start" style="padding: 24px 24px 12px;">
          <h3 class="font-bold text-lg">選擇消費日期</h3>
          <button class="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-400 hover:bg-brand-100 transition" @click="historyDatePickerOpen = false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div style="padding: 0 18px 24px;">
          <SharedCalendar
            v-model="historyCalendarDate"
            @update:model-value="selectHistoryDate"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.member-field {
  background: #f5f3f1;
  border: none;
  border-radius: 14px;
  padding: 14px 16px;
  font-size: 14px;
  color: #4a423d;
  outline: none;
  position: relative;
}
.member-field::placeholder {
  color: #b0aba7;
}
.member-field:disabled {
  opacity: 0.5;
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
