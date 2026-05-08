<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useToast } from '@/composables/useToast';
import { bookingsApi } from '@/api/bookings';
import { financeApi } from '@/api/finance';
import { servicesApi } from '@/api/services';
import { membersApi } from '@/api/members';
import type { Booking, FinanceSummary, PayMethod, Service, ServiceCat, Member } from '@/api/types';

const toast = useToast();
const loading = ref(false);
const summary = ref<FinanceSummary | null>(null);
const services = ref<Service[]>([]);

const showModal = ref(false);
const target = ref<Booking | null>(null);
const payMethod = ref<PayMethod>('現金');

// --- 折扣 ---
const discountRate = ref(1); // 1 = 原價, 0.7 = 7折
const newCustomerDiscount = ref(false);
const newCustomerAmount = ref(200);

// --- 手動金額 ---
const manualTotal = ref<number | null>(null);
const isEditingTotal = ref(false);

// --- 會員儲值金 ---
const checkoutMember = ref<Member | null>(null);
const useWallet = ref(false);

// --- 臨時加選服務 ---
const extraServices = ref<Set<string>>(new Set());
const showServicePicker = ref(false);
const serviceTab = ref<ServiceCat>('women');

const serviceTabs: Array<{ value: ServiceCat; label: string }> = [
  { value: 'women', label: '女生' },
  { value: 'men', label: '男士' },
  { value: 'eyelash', label: '睫毛' },
  { value: 'products', label: '產品' },
];

const filteredPickerServices = computed(() =>
  services.value.filter((s) => s.cat === serviceTab.value && s.isActive)
);

function toggleExtra(id: string) {
  const s = new Set(extraServices.value);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  extraServices.value = s;
}

const extraItems = computed(() =>
  services.value.filter((s) => extraServices.value.has(s.id))
);

const today = new Date().toISOString().slice(0, 10);
const currentMonth = today.slice(0, 7);

// 已結帳月份選擇（可往前翻月份）
const paidMonth = ref(currentMonth);

function paidMonthLabel(ym: string) {
  const [y, m] = ym.split('-');
  return `${y} 年 ${Number(m)} 月`;
}
function prevPaidMonth() {
  const [y, m] = paidMonth.value.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  paidMonth.value = d.toISOString().slice(0, 7);
  loadPaid();
}
function nextPaidMonth() {
  const [y, m] = paidMonth.value.split('-').map(Number);
  const d = new Date(y, m, 1);
  if (d.toISOString().slice(0, 7) > currentMonth) return;
  paidMonth.value = d.toISOString().slice(0, 7);
  loadPaid();
}

const pendingBookings = ref<Booking[]>([]);
const paidBookings = ref<Booking[]>([]);

const allPending = computed(() =>
  [...pendingBookings.value]
    .filter((b) => b.status !== '已取消' && b.date <= today)
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
);
const pendingToday = computed(() => allPending.value.filter((b) => b.date === today));
const pendingPast = computed(() => allPending.value.filter((b) => b.date < today));
const paid = computed(() =>
  [...paidBookings.value].sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''))
);

// 解析項目名稱，從 services 中找到對應價格和是否為套餐
// 同名服務可能在不同分類有不同價格（如女生小腿 vs 男士小腿），
// 透過比對預約總金額來選出正確的服務組合
const parsedItems = computed(() => {
  if (!target.value) return [];
  const names = target.value.items.split('、').map((n) => n.trim()).filter(Boolean);
  const bookingTotal = target.value.total;

  // 每個名稱找出所有候選服務
  const allCandidates = names.map((name) => services.value.filter((s) => s.name === name));

  // 嘗試找出總價符合預約金額的組合（考慮新客折 $200）
  function solve(idx: number, sum: number, chosen: (Service | undefined)[]): (Service | undefined)[] | null {
    if (idx === names.length) {
      if (sum === bookingTotal || sum === bookingTotal + 200) return chosen;
      return null;
    }
    const candidates = allCandidates[idx];
    if (candidates.length === 0) {
      return solve(idx + 1, sum, [...chosen, undefined]);
    }
    for (const svc of candidates) {
      const result = solve(idx + 1, sum + svc.price, [...chosen, svc]);
      if (result) return result;
    }
    return null;
  }

  const bestMatch = solve(0, 0, []);

  const original = names.map((name, i) => {
    const svc = bestMatch?.[i] ?? services.value.find((s) => s.name === name);
    return { name, price: svc?.price ?? 0, isCombo: svc?.isCombo ?? false, isExtra: false };
  });
  // 加上臨時加選的項目
  const extras = extraItems.value.map((s) => ({
    name: s.name, price: s.price, isCombo: s.isCombo, isExtra: true,
  }));
  return [...original, ...extras];
});

const originalTotal = computed(() => {
  const fromItems = parsedItems.value.reduce((sum, i) => sum + i.price, 0);
  return fromItems > 0 ? fromItems : (target.value?.total ?? 0);
});

// 可使用儲值金的金額（排除套餐）
const walletEligibleTotal = computed(() => {
  return parsedItems.value
    .filter((i) => !i.isCombo)
    .reduce((sum, i) => sum + i.price, 0);
});

// 套餐金額（不可用儲值金）
const comboTotal = computed(() => {
  return parsedItems.value
    .filter((i) => i.isCombo)
    .reduce((sum, i) => sum + i.price, 0);
});

// 已付訂金金額
const depositPaid = computed(() => {
  if (target.value?.depositStatus === '已付訂金') return target.value.depositAmount ?? 0;
  return 0;
});

const autoTotal = computed(() => {
  let amount = Math.round(originalTotal.value * discountRate.value);
  if (newCustomerDiscount.value) {
    amount -= newCustomerAmount.value;
  }
  amount -= depositPaid.value;
  return Math.max(0, amount);
});

const finalTotal = computed(() => {
  if (manualTotal.value !== null) return manualTotal.value;
  return autoTotal.value;
});

// 實際可從儲值金扣的金額
const walletDeduction = computed(() => {
  if (!useWallet.value || !checkoutMember.value) return 0;
  const eligible = Math.round(walletEligibleTotal.value * discountRate.value);
  return Math.min(eligible, checkoutMember.value.wallet);
});

// 還需現金/轉帳付的金額
const remainAfterWallet = computed(() => {
  return Math.max(0, finalTotal.value - walletDeduction.value);
});

const discountDiff = computed(() => originalTotal.value - finalTotal.value);

function startEditTotal() {
  manualTotal.value = finalTotal.value;
  isEditingTotal.value = true;
}

function finishEditTotal() {
  isEditingTotal.value = false;
}

async function loadPaid() {
  paidBookings.value = await bookingsApi.listAll({ paidMonth: paidMonth.value });
}

async function load() {
  loading.value = true;
  try {
    const [unpaidList, paidList, sum] = await Promise.all([
      bookingsApi.listAll({ paid: 'false' }), // 全部未結帳（跨月份）
      bookingsApi.listAll({ paidMonth: paidMonth.value }),
      financeApi.summary(),
    ]);
    pendingBookings.value = unpaidList;
    paidBookings.value = paidList;
    summary.value = sum;
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await load();
  services.value = await servicesApi.list();
});

const isEditingPaid = ref(false);

async function openCheckout(b: Booking) {
  target.value = b;
  isEditingPaid.value = false;
  payMethod.value = '現金';
  discountRate.value = 1;
  newCustomerDiscount.value = false;
  manualTotal.value = null;
  isEditingTotal.value = false;
  useWallet.value = false;
  extraServices.value = new Set();
  showServicePicker.value = false;
  checkoutMember.value = await membersApi.getByPhone(b.phone);
  showModal.value = true;
}

async function openEditPaid(b: Booking) {
  target.value = b;
  isEditingPaid.value = true;
  // 還原已結帳的狀態
  const pm = b.payMethod ?? '現金';
  payMethod.value = (pm === '儲值金' ? '現金' : pm) as PayMethod;
  discountRate.value = 1;
  newCustomerDiscount.value = false;
  manualTotal.value = b.total;
  isEditingTotal.value = false;
  useWallet.value = (b.walletUsed ?? 0) > 0;
  extraServices.value = new Set();
  showServicePicker.value = false;
  checkoutMember.value = await membersApi.getByPhone(b.phone);
  showModal.value = true;
}

async function confirmCheckout() {
  if (!target.value) return;

  const wallet = useWallet.value ? walletDeduction.value : 0;
  const oldWallet = isEditingPaid.value ? (target.value.walletUsed ?? 0) : 0;
  const walletDelta = wallet - oldWallet;

  // 調整儲值金（新結帳：扣款；編輯：補差額）
  if (walletDelta !== 0 && checkoutMember.value) {
    await membersApi.adjustWallet(checkoutMember.value.phone, -walletDelta,
      isEditingPaid.value ? '結帳修正' : '結帳扣款');
  }

  // payMethod = 剩餘金額的付款方式；若全額儲值金則設 '儲值金'
  const method = wallet > 0 && remainAfterWallet.value === 0
    ? '儲值金'
    : payMethod.value;

  // 若有加選項目，更新 items 與 duration
  const allItemNames = parsedItems.value.map((i) => i.name).join('、');
  const extraDur = extraItems.value.reduce((s, sv) => s + (sv.duration ?? 0), 0);
  const baseDuration = isEditingPaid.value
    ? parsedItems.value.filter((i) => !i.isExtra).reduce((s, i) => {
        const svc = services.value.find((sv) => sv.name === i.name);
        return s + (svc?.duration ?? 0);
      }, 0)
    : (target.value.duration ?? 0);
  const newDuration = baseDuration + extraDur;

  await bookingsApi.update(target.value.id, {
    items: allItemNames,
    duration: newDuration > 0 ? newDuration : null,
    payMethod: method,
    walletUsed: wallet > 0 ? wallet : null,
    ...(!isEditingPaid.value && { paidAt: new Date(`${target.value.date}T${target.value.time}:00`).toISOString() }),
    status: '已完成',
    total: finalTotal.value,
  });
  showModal.value = false;
  toast.show(isEditingPaid.value ? '結帳已修改' : '結帳完成');
  await load();
}

function setDiscount(rate: number) {
  discountRate.value = rate;
}

async function removePaid(b: Booking) {
  const msg = `確定刪除此筆結帳紀錄？\n\n${b.name} · ${b.date} ${b.time}\n金額 NT$ ${b.total}（${b.payMethod ?? ''}）\n\n此操作會從財務統計中扣除這筆收入，無法還原。`;
  if (!window.confirm(msg)) return;
  try {
    await bookingsApi.remove(b.id);
    await load();
  } catch (err) {
    const e = err as { response?: { status?: number; data?: { message?: string } } };
    window.alert(`刪除失敗：${e.response?.data?.message ?? '請稍後再試'}`);
  }
}

// --- 收合/展開 ---
const pendingExpanded = ref(true);
const pastPendingExpanded = ref(true);
const paidExpanded = ref(true);

const payMethodOptions: { value: PayMethod; icon: string; label: string }[] = [
  { value: '現金', icon: '💰', label: '現金' },
  { value: '轉帳', icon: '🏦', label: '轉帳' },
  { value: '空檔費', icon: '🕳️', label: '空檔費' },
];
</script>

<template>
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-2">
      <div class="card !p-2.5 !rounded-xl">
        <p class="section-label mb-0.5">本月結帳</p>
        <p class="text-base font-extrabold text-brand-600 leading-none">{{ summary?.month.bookings ?? 0 }}</p>
        <p class="section-label mt-0.5">筆</p>
      </div>
      <div class="card !p-2.5 !rounded-xl">
        <p class="section-label mb-0.5">本月營收</p>
        <p class="text-xs font-extrabold text-brand-600 leading-none tracking-tight">NT$ {{ summary?.month.revenue ?? 0 }}</p>
      </div>
    </div>

    <section>
      <button class="w-full flex items-center justify-between mb-2" @click="pendingExpanded = !pendingExpanded">
        <h2 class="font-bold">當日待結帳<span v-if="pendingToday.length" class="text-brand-400 font-normal text-sm ml-1">({{ pendingToday.length }})</span></h2>
        <svg class="w-4 h-4 text-brand-400 transition-transform duration-200" :class="{ 'rotate-180': pendingExpanded }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div v-show="pendingExpanded">
        <p v-if="loading" class="text-center text-brand-400 py-4">載入中…</p>
        <p v-else-if="!pendingToday.length" class="text-center text-brand-400 py-4">今日沒有待結帳項目</p>
        <ul v-else class="space-y-1.5">
          <li v-for="b in pendingToday" :key="b.id" class="card !p-2.5 !rounded-xl flex justify-between items-center">
            <div>
              <div class="font-bold text-xs">{{ b.name }}</div>
              <div class="text-[11px] text-brand-500">{{ b.date }} {{ b.time }}</div>
              <div class="text-[10px] text-brand-400 mt-0.5">{{ b.items }}</div>
            </div>
            <div class="text-right">
              <div class="text-brand-600 font-bold text-xs">${{ b.total }}</div>
              <span class="badge text-[9px] mt-0.5" :class="{
                'badge-pending': b.status === '待確認',
                'badge-confirmed': b.status === '已確認',
                'badge-done': b.status === '已完成',
              }">{{ b.status }}</span>
              <button class="btn-primary !text-[11px] !py-0.5 mt-0.5 block ml-auto" @click="openCheckout(b)">結帳</button>
            </div>
          </li>
        </ul>
      </div>
    </section>

    <section v-if="pendingPast.length">
      <button class="w-full flex items-center justify-between mb-2" @click="pastPendingExpanded = !pastPendingExpanded">
        <h2 class="font-bold">過去未結帳<span class="text-brand-400 font-normal text-sm ml-1">({{ pendingPast.length }})</span></h2>
        <svg class="w-4 h-4 text-brand-400 transition-transform duration-200" :class="{ 'rotate-180': pastPendingExpanded }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <ul v-show="pastPendingExpanded" class="space-y-1.5">
        <li v-for="b in pendingPast" :key="b.id" class="card !p-2.5 !rounded-xl flex justify-between items-center">
          <div>
            <div class="font-bold text-xs">{{ b.name }}</div>
            <div class="text-[11px] text-brand-500">{{ b.date }} {{ b.time }}</div>
            <div class="text-[10px] text-brand-400 mt-0.5">{{ b.items }}</div>
          </div>
          <div class="text-right">
            <div class="text-brand-600 font-bold text-xs">${{ b.total }}</div>
            <span class="badge text-[9px] mt-0.5" :class="{
              'badge-pending': b.status === '待確認',
              'badge-confirmed': b.status === '已確認',
              'badge-done': b.status === '已完成',
            }">{{ b.status }}</span>
            <button class="btn-primary !text-[11px] !py-0.5 mt-0.5 block ml-auto" @click="openCheckout(b)">結帳</button>
          </div>
        </li>
      </ul>
    </section>

    <section>
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <button class="w-6 h-6 rounded-full bg-brand-50 flex items-center justify-center text-brand-400 hover:bg-brand-100 transition" @click.stop="prevPaidMonth">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <h2 class="font-bold text-sm cursor-pointer" @click="paidExpanded = !paidExpanded">
            已結帳 · {{ paidMonthLabel(paidMonth) }}
            <span v-if="paid.length" class="text-brand-400 font-normal text-sm ml-1">({{ paid.length }})</span>
          </h2>
          <button
            class="w-6 h-6 rounded-full flex items-center justify-center transition"
            :class="paidMonth < currentMonth ? 'bg-brand-50 text-brand-400 hover:bg-brand-100' : 'bg-brand-50/50 text-brand-200 cursor-not-allowed'"
            :disabled="paidMonth >= currentMonth"
            @click.stop="nextPaidMonth"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
        <button @click="paidExpanded = !paidExpanded">
          <svg class="w-4 h-4 text-brand-400 transition-transform duration-200" :class="{ 'rotate-180': paidExpanded }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
        </button>
      </div>
      <ul v-if="paid.length" v-show="paidExpanded" class="space-y-1.5">
        <li v-for="b in paid" :key="b.id" class="card !p-2.5 !rounded-xl">
          <div class="flex justify-between items-start gap-2">
            <div class="min-w-0 flex-1">
              <div class="font-bold text-xs">{{ b.name }}</div>
              <div class="text-[11px] text-brand-500">{{ b.date }} {{ b.time }} · {{ b.items }}</div>
            </div>
            <div class="text-right shrink-0">
              <div class="text-brand-600 font-bold text-xs">${{ b.total }}</div>
              <div class="text-[11px] text-brand-500">{{ b.payMethod }}</div>
              <div class="flex items-center gap-1 mt-0.5 justify-end">
                <button
                  class="w-5 h-5 rounded-full bg-brand-50 flex items-center justify-center text-brand-400 hover:bg-brand-100 transition"
                  title="編輯此筆結帳紀錄"
                  @click="openEditPaid(b)"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button
                  class="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 transition"
                  title="刪除此筆結帳紀錄"
                  @click="removePaid(b)"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
          </div>
        </li>
      </ul>
      <p v-else v-show="paidExpanded" class="text-center text-brand-400 py-4">尚無結帳紀錄</p>
    </section>

    <!-- Checkout Modal -->
    <div v-if="showModal && target" class="fixed inset-0 z-30 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.5);">
      <div class="bg-white w-full max-w-[360px] flex flex-col" style="border-radius:24px; max-height: 88dvh; overflow: hidden;">
        <!-- Header -->
        <div class="flex justify-between items-start shrink-0" style="padding: 24px 24px 12px;">
          <h3 class="font-bold text-lg">{{ isEditingPaid ? '編輯結帳' : '結帳' }}</h3>
          <button class="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-400 hover:bg-brand-100 transition" @click="showModal = false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- 可滾動內容 -->
        <div class="flex-1 overflow-y-auto no-scrollbar" style="padding: 0 24px 24px;">

          <!-- 日期時間 -->
          <p class="text-center font-bold text-sm text-brand-600 mb-4">{{ target.date }} {{ target.time }}</p>

          <!-- 客戶資訊 -->
          <div class="co-field mb-3">
            <div class="font-bold text-sm">{{ target.name }}</div>
            <div class="text-xs text-brand-400 mt-0.5">{{ target.phone }}</div>
          </div>

          <!-- 項目明細 -->
          <div class="co-field mb-2 space-y-2">
            <div v-for="item in parsedItems" :key="item.name" class="flex justify-between items-center">
              <div class="flex items-center gap-1.5">
                <span class="text-sm font-bold text-brand-600">{{ item.name }}</span>
                <span v-if="item.isCombo" class="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">套餐</span>
                <span v-if="item.isExtra" class="text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">加選</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-sm font-bold text-brand-600">NT$ {{ item.price.toLocaleString() }}</span>
                <button
                  v-if="item.isExtra"
                  class="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 transition"
                  @click="toggleExtra(services.find((s) => s.name === item.name)?.id ?? '')"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
          </div>

          <!-- 加選項目 -->
          <button
            type="button"
            class="w-full flex items-center justify-center gap-1.5 py-2.5 mb-4 text-xs font-bold rounded-2xl border-[1.5px] border-dashed transition-all"
            :class="showServicePicker ? 'border-brand-400 text-brand-600 bg-brand-50' : 'border-brand-200 text-brand-400'"
            @click="showServicePicker = !showServicePicker"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
            <span>{{ showServicePicker ? '收起' : '新增項目' }}</span>
          </button>

          <!-- 服務選擇器 -->
          <div v-if="showServicePicker" class="mb-4 p-3 rounded-2xl" style="background: #f8f7f5;">
            <div class="flex gap-2 mb-3">
              <button
                v-for="t in serviceTabs"
                :key="t.value"
                type="button"
                class="text-[10px] font-bold pb-1 transition-colors"
                :class="serviceTab === t.value ? 'text-brand-600 border-b-2 border-brand-600' : 'text-brand-300'"
                @click="serviceTab = t.value"
              >
                {{ t.label }}
              </button>
            </div>
            <div class="space-y-1.5 max-h-[180px] overflow-y-auto no-scrollbar">
              <button
                v-for="s in filteredPickerServices"
                :key="s.id"
                type="button"
                class="w-full flex justify-between items-center px-3 py-2.5 rounded-xl text-left transition-all"
                :class="extraServices.has(s.id) ? 'bg-brand-600 text-white' : 'bg-white'"
                @click="toggleExtra(s.id)"
              >
                <span class="text-xs font-bold" :class="extraServices.has(s.id) ? 'text-white' : 'text-brand-600'">{{ s.name }}</span>
                <span class="text-xs font-bold" :class="extraServices.has(s.id) ? 'text-white/80' : 'text-brand-500'">NT$ {{ s.price.toLocaleString() }}</span>
              </button>
              <p v-if="!filteredPickerServices.length" class="text-center text-brand-300 text-[10px] py-2">此分類無服務</p>
            </div>
          </div>

          <!-- 折扣 -->
          <div class="mb-4">
            <p class="text-xs text-brand-400 font-bold mb-2">折扣</p>
            <div class="flex gap-2 mb-3">
              <button
                v-for="d in [{ rate: 0.7, label: '7 折' }, { rate: 0.8, label: '8 折' }, { rate: 0.9, label: '9 折' }, { rate: 1, label: '原價' }]"
                :key="d.rate"
                type="button"
                class="flex-1 py-2.5 text-xs font-bold text-center rounded-xl border-[1.5px] transition-all"
                :class="discountRate === d.rate
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-brand-500 border-brand-200'"
                @click="setDiscount(d.rate)"
              >
                {{ d.label }}
              </button>
            </div>

            <!-- 新客優惠 -->
            <button
              type="button"
              class="w-full flex items-center justify-between px-4 py-3 rounded-2xl border-[1.5px] transition-all"
              :class="newCustomerDiscount
                ? 'bg-amber-50 border-amber-300'
                : 'bg-white border-brand-100'"
              @click="newCustomerDiscount = !newCustomerDiscount"
            >
              <div class="flex items-center gap-2">
                <span class="text-sm">✨</span>
                <span class="text-xs font-bold" :class="newCustomerDiscount ? 'text-amber-700' : 'text-brand-400'">新客優惠</span>
                <span v-if="newCustomerDiscount" class="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>
                </span>
                <span class="text-xs font-bold" :class="newCustomerDiscount ? 'text-amber-700' : 'text-brand-400'">折抵 NT$ {{ newCustomerAmount }}</span>
              </div>
              <span v-if="newCustomerDiscount" class="text-sm font-extrabold text-amber-600">-NT$ {{ newCustomerAmount }}</span>
            </button>
          </div>

          <!-- 已付訂金提示 -->
          <div v-if="depositPaid > 0" class="mb-4">
            <div class="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-amber-50 border-[1.5px] border-amber-300">
              <div class="flex items-center gap-2">
                <span class="text-sm">💰</span>
                <span class="text-xs font-bold text-amber-700">已付預約金</span>
                <span class="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>
                </span>
              </div>
              <span class="text-sm font-extrabold text-amber-600">-NT$ {{ depositPaid }}</span>
            </div>
          </div>

          <!-- 儲值金 -->
          <div v-if="checkoutMember && checkoutMember.wallet > 0" class="mb-4">
            <p class="text-xs text-brand-400 font-bold mb-2">儲值金</p>
            <button
              type="button"
              class="w-full flex items-center justify-between px-4 py-3 rounded-2xl border-[1.5px] transition-all"
              :class="useWallet ? 'bg-green-50 border-green-300' : 'bg-white border-brand-100'"
              @click="useWallet = !useWallet"
            >
              <div class="flex items-center gap-2">
                <span class="text-sm">💳</span>
                <span class="text-xs font-bold" :class="useWallet ? 'text-green-700' : 'text-brand-400'">使用儲值金</span>
                <span v-if="useWallet" class="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>
                </span>
                <span class="text-[10px] font-bold" :class="useWallet ? 'text-green-600' : 'text-brand-300'">餘額 NT$ {{ checkoutMember.wallet.toLocaleString() }}</span>
              </div>
              <span v-if="useWallet" class="text-sm font-extrabold text-green-600">-NT$ {{ walletDeduction.toLocaleString() }}</span>
            </button>
            <p v-if="comboTotal > 0" class="text-[10px] text-amber-500 mt-1.5 ml-1">* 套餐項目不可使用儲值金折抵</p>
          </div>

          <!-- 應付金額 -->
          <div class="flex items-end justify-between mb-1">
            <span class="text-sm font-bold text-brand-500">應付金額</span>
            <div v-if="!isEditingTotal" class="text-right flex items-end gap-1 cursor-pointer" @click="startEditTotal">
              <span class="text-sm text-brand-400">NT$</span>
              <span class="text-2xl font-extrabold text-brand-700">{{ finalTotal.toLocaleString() }}</span>
              <svg class="w-4 h-4 text-brand-300 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </div>
            <div v-else class="flex items-center gap-1">
              <span class="text-sm text-brand-400">NT$</span>
              <input
                v-model.number="manualTotal"
                type="number"
                class="text-2xl font-extrabold text-brand-700 bg-brand-50 rounded-xl px-3 py-1 outline-none text-right"
                style="width: 140px; border: 2px solid #c4beba;"
                @blur="finishEditTotal"
                @keyup.enter="finishEditTotal"
              />
            </div>
          </div>
          <div class="text-right mb-1">
            <span v-if="discountDiff > 0" class="text-xs text-brand-400 line-through">原價 NT$ {{ originalTotal.toLocaleString() }}</span>
          </div>
          <div v-if="useWallet && walletDeduction > 0 && remainAfterWallet > 0" class="text-right mb-1">
            <span class="text-xs text-green-600 font-bold">儲值金折抵 -NT$ {{ walletDeduction.toLocaleString() }}，尚需付 NT$ {{ remainAfterWallet.toLocaleString() }}</span>
          </div>
          <div v-if="useWallet && remainAfterWallet === 0" class="text-right mb-1">
            <span class="text-xs text-green-600 font-bold">儲值金全額支付</span>
          </div>
          <div class="mb-4"></div>

          <!-- 付款方式 -->
          <p class="text-xs text-brand-400 font-bold mb-2">付款方式{{ useWallet && remainAfterWallet > 0 ? '（剩餘金額）' : '' }}</p>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="m in payMethodOptions"
              :key="m.value"
              type="button"
              class="flex items-center justify-center gap-1.5 py-3 text-xs font-bold rounded-2xl border-[1.5px] transition-all"
              :class="payMethod === m.value
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-brand-500 border-brand-200'"
              @click="payMethod = m.value"
            >
              <span>{{ m.icon }}</span>
              <span>{{ m.label }}</span>
            </button>
          </div>
        </div>

        <!-- 固定底部按鈕 -->
        <div class="shrink-0 flex gap-2 border-t border-brand-100" style="padding: 16px 24px calc(16px + env(safe-area-inset-bottom, 0px));">
          <button class="btn-outline flex-1" @click="showModal = false">取消</button>
          <button class="btn-primary flex-1" @click="confirmCheckout">{{ isEditingPaid ? '儲存修改' : '確認結帳' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.co-field {
  background: #f5f3f1;
  border: none;
  border-radius: 14px;
  padding: 14px 16px;
}
</style>
